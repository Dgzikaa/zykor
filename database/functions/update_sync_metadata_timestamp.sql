-- Função: update_sync_metadata_timestamp (trigger function)
-- Atualiza timestamp em sync_metadata

CREATE OR REPLACE FUNCTION public.update_sync_metadata_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
