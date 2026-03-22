-- Função: sync_contahub_ambos_bares
-- Sincroniza dados do ContaHub para ambos os bares (3 e 4)
-- Usada pelo cron diário

CREATE OR REPLACE FUNCTION public.sync_contahub_ambos_bares()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  data_ontem text;
  request_id_ordinario bigint;
  request_id_deboche bigint;
BEGIN
  data_ontem := (current_date - interval '1 day')::text;
  RAISE NOTICE 'Sincronizando ContaHub para %', data_ontem;
  
  BEGIN
    SELECT net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'bar_id', 3,
        'data_date', data_ontem,
        'automated', true,
        'source', 'pgcron-unificado'
      ),
      timeout_milliseconds := 60000
    ) INTO request_id_ordinario;
    
    RAISE NOTICE 'ContaHub Ordinario - Request ID: %', request_id_ordinario;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ContaHub Ordinario: %', SQLERRM;
  END;
  
  PERFORM pg_sleep(2);
  
  BEGIN
    SELECT net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'bar_id', 4,
        'data_date', data_ontem,
        'automated', true,
        'source', 'pgcron-unificado'
      ),
      timeout_milliseconds := 60000
    ) INTO request_id_deboche;
    
    RAISE NOTICE 'ContaHub Deboche - Request ID: %', request_id_deboche;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro ContaHub Deboche: %', SQLERRM;
  END;
END;
$function$;
