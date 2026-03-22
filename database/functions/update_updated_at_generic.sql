-- Função: update_updated_at_generic (trigger function)
-- Atualiza campo updated_at automaticamente

CREATE OR REPLACE FUNCTION public.update_updated_at_generic()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;
