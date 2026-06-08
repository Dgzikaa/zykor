-- 2026-06-08 — Fix: sync diário de pessoas/fornecedores do Conta Azul estourava
-- statement_timeout (cron roda como postgres, default 120s, e a função faz 2
-- chamadas http síncronas cobrindo os 2 bares num único SELECT).
-- Correções:
--   1) statement_timeout próprio (600s) + curl reduzido p/ 250s por bar.
--   2) statement_timeout no COMANDO do cron (SET na função NÃO re-arma o timer da
--      statement de topo — gotcha do Postgres; tem que ser statement separada).
--   3) Remove cron órfão patch-nps-digital-agregado (chamava função inexistente).
-- Aplicado em prod via MCP nesta data; arquivo versiona o estado.

CREATE OR REPLACE FUNCTION public.sync_contaazul_pessoas_diario()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'bronze'
 SET statement_timeout TO '600000'
AS $function$
DECLARE
  bar_record RECORD;
  resultado JSONB;
  v_service_key TEXT;
BEGIN
  v_service_key := get_service_role_key();
  PERFORM http_set_curlopt('CURLOPT_TIMEOUT_MS', '250000');

  FOR bar_record IN
    SELECT DISTINCT bar_id FROM api_credentials
    WHERE sistema = 'conta_azul' AND access_token IS NOT NULL
  LOOP
    BEGIN
      SELECT content::jsonb INTO resultado
      FROM http((
        'POST', get_supabase_url() || '/functions/v1/contaazul-sync',
        ARRAY[
          http_header('Authorization', 'Bearer ' || v_service_key),
          http_header('Content-Type', 'application/json')
        ], 'application/json',
        json_build_object('bar_id', bar_record.bar_id,
                          'sync_mode', 'daily_incremental')::text
      ));
      IF resultado->>'success' = 'true' THEN
        RAISE NOTICE 'CA pessoas diario bar=%: % pessoas',
          bar_record.bar_id, COALESCE((resultado->'stats'->>'pessoas')::text, '0');
      ELSE
        RAISE WARNING 'CA pessoas diario ERRO bar %: %', bar_record.bar_id, resultado;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'CA pessoas diario excecao bar %: %', bar_record.bar_id, SQLERRM;
    END;
  END LOOP;
END;
$function$;

-- Cron com statement_timeout na própria statement (re-arma o timer).
SELECT cron.schedule(
  'contaazul-pessoas-diario',
  '0 8 * * *',
  $cron$SET statement_timeout = '400000'; SELECT public.sync_contaazul_pessoas_diario();$cron$
);

-- Remove cron órfão (função não existe mais; NPS digital já é populado pelo silver).
DO $$ BEGIN
  PERFORM cron.unschedule('patch-nps-digital-agregado');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
