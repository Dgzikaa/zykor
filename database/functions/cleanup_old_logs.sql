-- Função: cleanup_old_logs
-- Remove logs antigos de diversas tabelas de auditoria
-- Política de retenção por tabela

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
 RETURNS TABLE(tabela text, registros_removidos bigint)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count BIGINT;
BEGIN
  -- audit_trail: manter 90 dias
  DELETE FROM audit_trail 
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'audit_trail';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- umbler_webhook_logs: manter 30 dias
  DELETE FROM umbler_webhook_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'umbler_webhook_logs';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- checklist_automation_logs: manter 60 dias
  DELETE FROM checklist_automation_logs 
  WHERE criado_em < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'checklist_automation_logs';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- getin_sync_logs: manter 30 dias
  DELETE FROM getin_sync_logs 
  WHERE synced_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'getin_sync_logs';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- nibo_logs_sincronizacao: manter 60 dias
  DELETE FROM nibo_logs_sincronizacao 
  WHERE criado_em < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'nibo_logs_sincronizacao';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- recalculo_eventos_log: manter 90 dias
  DELETE FROM recalculo_eventos_log 
  WHERE executado_em < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'recalculo_eventos_log';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- eventos_base_auditoria: manter 180 dias
  DELETE FROM eventos_base_auditoria 
  WHERE criado_em < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'eventos_base_auditoria';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- security_events: manter 90 dias
  DELETE FROM security_events 
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'security_events';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- automation_logs: manter 60 dias
  DELETE FROM automation_logs 
  WHERE executed_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'automation_logs';
  registros_removidos := v_count;
  RETURN NEXT;
  
  -- system_logs: manter 60 dias
  DELETE FROM system_logs 
  WHERE timestamp < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  tabela := 'system_logs';
  registros_removidos := v_count;
  RETURN NEXT;
  
  RETURN;
END;
$function$;
