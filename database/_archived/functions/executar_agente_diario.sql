-- Função: executar_agente_diario
CREATE OR REPLACE FUNCTION public.executar_agente_diario() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ DECLARE v_response http_response; BEGIN SELECT * INTO v_response FROM http_get('https://zykor.vercel.app/api/exploracao/agente-diario?secret=zykor-cron-secret-2026&bar_id=3'); RAISE NOTICE 'Agente executado. Status: %', v_response.status; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Erro: %', SQLERRM; END; $$;
