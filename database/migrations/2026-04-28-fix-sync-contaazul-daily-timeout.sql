-- 2026-04-28: Fix sync_contaazul_daily timeout silencioso
--
-- Contexto: cron 354 (contaazul-sync-8h) chama public.sync_contaazul_daily()
-- que invoca a edge function via http(). Default da extensao http e' 5s,
-- mas a edge function leva 12-30s. Resultado: timeout disparava
-- "Operation timed out after 5002 ms with 0 bytes received", o
-- EXCEPTION WHEN OTHERS engolia em silencio, e a edge function nunca era
-- invocada (zero logs no edge-function service). Cron marcava "succeeded"
-- de qualquer jeito (a SQL function retorna void sem erro).
--
-- Combinado com o bug de schema na edge function (`.from('contaazul_*')`
-- sem `.schema('integrations')` apos a refatoracao medallion ~2026-04-16),
-- isso paralisou o sync por 12 dias sem alerta visivel.
--
-- Fix: PERFORM http_set_curlopt('CURLOPT_TIMEOUT_MS', '120000') antes do
-- loop. Setting e' session-level — o cron roda em sessao propria, nao
-- impacta outras chamadas.

CREATE OR REPLACE FUNCTION public.sync_contaazul_daily()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  bar_record RECORD;
  resultado JSONB;
  v_service_key TEXT;
  v_eventos_recalculados INTEGER;
BEGIN
  v_service_key := get_service_role_key();

  -- Bump http() timeout: edge function leva 12-30s; default de 5s estava
  -- estourando silenciosamente e impedindo a invocação da contaazul-sync.
  PERFORM http_set_curlopt('CURLOPT_TIMEOUT_MS', '120000');

  RAISE NOTICE 'Iniciando sincronizacao diaria do Conta Azul';

  FOR bar_record IN
    SELECT DISTINCT bar_id
    FROM api_credentials
    WHERE sistema = 'conta_azul'
      AND access_token IS NOT NULL
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
          'sync_mode', 'daily_incremental'
        )::text
      ));

      IF resultado->>'success' = 'true' THEN
        RAISE NOTICE 'Bar % sincronizado: % lancamentos',
          bar_record.bar_id,
          COALESCE((resultado->'stats'->>'lancamentos')::text, '0');
      ELSE
        RAISE WARNING 'Erro na sincronizacao do bar %: %',
          bar_record.bar_id, resultado;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao sincronizar bar %: %',
        bar_record.bar_id, SQLERRM;
    END;
  END LOOP;

  -- Recalcular eventos dos ultimos 7 dias apos sincronizacao
  RAISE NOTICE 'Recalculando eventos dos ultimos 7 dias...';
  SELECT eventos_recalculados INTO v_eventos_recalculados
  FROM recalcular_eventos_recentes(7);
  RAISE NOTICE 'Eventos recalculados: %', v_eventos_recalculados;

  RAISE NOTICE 'Sincronizacao diaria do Conta Azul concluida';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro na sincronizacao Conta Azul: %', SQLERRM;
END;
$function$;
