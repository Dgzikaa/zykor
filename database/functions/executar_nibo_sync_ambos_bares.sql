-- Função: executar_nibo_sync_ambos_bares
-- Sincroniza dados do NIBO para ambos os bares (3 e 4)
-- Usada pelo cron diário

CREATE OR REPLACE FUNCTION public.executar_nibo_sync_ambos_bares()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  request_id_ordinario BIGINT;
  request_id_deboche BIGINT;
BEGIN
  RAISE NOTICE 'Executando NIBO sync para ambos os bares...';
  
  BEGIN
    SELECT net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/integracao-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
      ),
      body := jsonb_build_object(
        'action', 'nibo',
        'barId', 3,
        'cronSecret', 'pgcron_nibo',
        'sync_mode', 'daily_complete'
      ),
      timeout_milliseconds := 60000
    ) INTO request_id_ordinario;
    
    RAISE NOTICE 'NIBO Ordinario - Request ID: %', request_id_ordinario;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro NIBO Ordinario: %', SQLERRM;
  END;
  
  PERFORM pg_sleep(2);
  
  BEGIN
    SELECT net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/integracao-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
      ),
      body := jsonb_build_object(
        'action', 'nibo',
        'barId', 4,
        'cronSecret', 'pgcron_nibo',
        'sync_mode', 'daily_complete'
      ),
      timeout_milliseconds := 60000
    ) INTO request_id_deboche;
    
    RAISE NOTICE 'NIBO Deboche - Request ID: %', request_id_deboche;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Erro NIBO Deboche: %', SQLERRM;
  END;
END;
$function$;
