-- Função: executar_recalculo_desempenho_auto (LEGADO - usar executar_recalculo_desempenho_v2)
CREATE OR REPLACE FUNCTION public.executar_recalculo_desempenho_auto() RETURNS void LANGUAGE plpgsql
AS $$ DECLARE v_url TEXT; v_request_id BIGINT; BEGIN
v_url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-auto';
RAISE NOTICE 'Executando recálculo automático de desempenho via Edge Function...';
SELECT net.http_post(url := v_url, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer [SERVICE_ROLE_KEY]'), body := '{}'::jsonb, timeout_milliseconds := 60000) INTO v_request_id;
RAISE NOTICE 'Request ID: %', v_request_id;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Erro ao executar recálculo automático: %', SQLERRM;
END; $$;
