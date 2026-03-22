-- Função: limpar_heartbeats_antigos
-- Remove heartbeats antigos da tabela cron_heartbeats
-- Usada pelo cron de limpeza semanal

CREATE OR REPLACE FUNCTION public.limpar_heartbeats_antigos(dias_manter integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.cron_heartbeats
  WHERE created_at < NOW() - (dias_manter || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;
