-- Migration: 2026-04-24-fix-limpar-heartbeats-schema
-- Contexto: Followup pos-merge da Etapa 4.
-- Fix: public.limpar_heartbeats_antigos() deletava de public.cron_heartbeats
-- (tabela que nao existe). Tabela real vive em system.cron_heartbeats.
-- Funcao nao esta agendada em cron.job (orfan), mas fica consistente.
--
-- Rollback:
--   Restore body with 'DELETE FROM public.cron_heartbeats'

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
