-- Funcao: limpar_heartbeats_antigos
-- Remove heartbeats antigos da tabela system.cron_heartbeats
-- Fix 2026-04-24: schema `public` estava errado (tabela vive em `system`).
-- Nao ha cron chamando esta funcao atualmente - orfan historica, mas fica
-- consistente com a realidade do banco.

CREATE OR REPLACE FUNCTION public.limpar_heartbeats_antigos(dias_manter integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM system.cron_heartbeats
  WHERE created_at < NOW() - (dias_manter || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;
