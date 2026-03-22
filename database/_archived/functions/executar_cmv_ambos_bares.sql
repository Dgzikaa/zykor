-- Função: executar_cmv_ambos_bares
CREATE OR REPLACE FUNCTION public.executar_cmv_ambos_bares() RETURNS void LANGUAGE plpgsql
AS $$ DECLARE request_id_ordinario BIGINT; request_id_deboche BIGINT; BEGIN
RAISE NOTICE 'Executando CMV semanal para ambos os bares...';
BEGIN SELECT net.http_post(url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/cmv-semanal-auto', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer [SERVICE_ROLE_KEY]'), body := jsonb_build_object('bar_id', 3, 'automated', true, 'source', 'pg_cron_unificado'), timeout_milliseconds := 60000) INTO request_id_ordinario; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Erro CMV Ordinário: %', SQLERRM; END;
PERFORM pg_sleep(2);
BEGIN SELECT net.http_post(url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/cmv-semanal-auto', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer [SERVICE_ROLE_KEY]'), body := jsonb_build_object('bar_id', 4, 'automated', true, 'source', 'pg_cron_unificado'), timeout_milliseconds := 60000) INTO request_id_deboche; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Erro CMV Deboche: %', SQLERRM; END;
END; $$;
