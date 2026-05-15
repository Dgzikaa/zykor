-- Sync Conta Azul: ampliar janela do recalculo de eventos de 7 para 30 dias
-- ============================================================================
-- Contexto:
-- Planejamento comercial mostrava c_art/c_prod desatualizado para eventos
-- com lancamentos retroativos no Conta Azul. Exemplo concreto Ord 03/05/2026:
--
--   04/05 17:25  Lancamento R$ 600 (Allyson - DJ)             criado no CA
--   12/05 09:30  Sync trouxe pra bronze
--   12/05 12:58  calculate_evento_metrics rodou -> c_art = 600
--   13/05 16:38  Lancamento R$ 11.752 (GRUPO DOZE POR OITO)   criado no CA (9 dias depois!)
--   15/05 09:30  Sync trouxe pra bronze
--   15/05 ----   recalcular_eventos_recentes(7) IGNOROU 03/05 (12 dias atras, fora da janela)
--
-- Causa raiz: sync_contaazul_daily chamava recalcular_eventos_recentes(7).
-- Esse 7 e' a janela em dias para tras a partir de CURRENT_DATE — qualquer
-- lancamento retroativo posterior a esse limite nunca propagava pra
-- operations.eventos_base (c_art, c_prod, percent_art_fat).
--
-- Fix: ampliar janela para 30 dias. Cobre o periodo tipico em que o financeiro
-- ainda lanca despesas (folha, fornecedores em atraso, ajustes contabeis).
-- Custo: ~30 eventos/bar * 3 execucoes/dia * 2 bares = ~180 calculate_evento_metrics
-- por dia, todos rapidos (~50ms cada). Negligivel.
--
-- Backfill imediato dos eventos afetados (15/04 a 15/05) foi feito em separado
-- via DO block (nao precisa replay desta migration).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_contaazul_daily()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  bar_record RECORD;
  resultado JSONB;
  v_service_key TEXT;
  v_eventos_recalculados INTEGER;
BEGIN
  v_service_key := get_service_role_key();
  PERFORM http_set_curlopt('CURLOPT_TIMEOUT_MS', '180000');

  RAISE NOTICE 'Iniciando sincronizacao do Conta Azul (full_month + soft-delete)';

  FOR bar_record IN
    SELECT DISTINCT bar_id FROM api_credentials
    WHERE sistema = 'conta_azul' AND access_token IS NOT NULL
  LOOP
    BEGIN
      RAISE NOTICE 'Sincronizando Conta Azul para bar_id=%', bar_record.bar_id;
      SELECT content::jsonb INTO resultado
      FROM http((
        'POST',
        get_supabase_url() || '/functions/v1/contaazul-sync',
        ARRAY[
          http_header('Authorization', 'Bearer ' || v_service_key),
          http_header('Content-Type', 'application/json')
        ],
        'application/json',
        json_build_object(
          'bar_id', bar_record.bar_id,
          'sync_mode', 'full_month'
        )::text
      ));

      IF resultado->>'success' = 'true' THEN
        RAISE NOTICE 'Bar % sincronizado: % lancamentos',
          bar_record.bar_id,
          COALESCE((resultado->'stats'->>'lancamentos')::text, '0');
      ELSE
        RAISE WARNING 'Erro na sincronizacao do bar %: %', bar_record.bar_id, resultado;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao sincronizar bar %: %', bar_record.bar_id, SQLERRM;
    END;
  END LOOP;

  -- Janela ampliada de 7 -> 30 dias para cobrir lancamentos retroativos no CA
  -- (financeiro lanca despesas dias depois do evento; janela curta perdia esses casos)
  RAISE NOTICE 'Recalculando eventos dos ultimos 30 dias...';
  SELECT eventos_recalculados INTO v_eventos_recalculados
  FROM recalcular_eventos_recentes(30);
  RAISE NOTICE 'Eventos recalculados: %', v_eventos_recalculados;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro na sincronizacao Conta Azul: %', SQLERRM;
END;
$function$;
