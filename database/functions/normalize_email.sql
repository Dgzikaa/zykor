-- Função: normalize_email (trigger)
CREATE OR REPLACE FUNCTION public.normalize_email() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$ BEGIN NEW.email = LOWER(TRIM(NEW.email)); RETURN NEW; END; $$;
