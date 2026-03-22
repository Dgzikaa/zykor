-- Função: update_updated_at_column (trigger genérico)
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
