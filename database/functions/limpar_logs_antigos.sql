-- Função: limpar_logs_antigos
CREATE OR REPLACE FUNCTION public.limpar_logs_antigos() RETURNS void LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$ BEGIN PERFORM cleanup_old_logs(); END; $$;
