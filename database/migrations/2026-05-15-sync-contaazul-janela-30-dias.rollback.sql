-- Rollback: voltar janela do recalculo para 7 dias
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

  RAISE NOTICE 'Recalculando eventos dos ultimos 7 dias...';
  SELECT eventos_recalculados INTO v_eventos_recalculados
  FROM recalcular_eventos_recentes(7);
  RAISE NOTICE 'Eventos recalculados: %', v_eventos_recalculados;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro na sincronizacao Conta Azul: %', SQLERRM;
END;
$function$;
