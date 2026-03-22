-- Função: trigger_sync_mesas_after_getin_change (trigger function)
-- Sincroniza mesas após alterações em getin_reservations

CREATE OR REPLACE FUNCTION public.trigger_sync_mesas_after_getin_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM sync_mesas_getin_to_eventos();
  RETURN NULL;
END;
$function$;
