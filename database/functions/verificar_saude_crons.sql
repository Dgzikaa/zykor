-- Função: verificar_saude_crons
-- Verifica jobs com problemas: stale, stuck ou error
-- Usada pelo cron-watchdog para monitoramento

CREATE OR REPLACE FUNCTION public.verificar_saude_crons(p_stale_minutes integer DEFAULT 120, p_stuck_minutes integer DEFAULT 30, p_error_hours integer DEFAULT 24)
 RETURNS TABLE(job_name text, tipo_problema text, status text, tempo_sem_execucao_minutos integer, ultima_execucao timestamp with time zone, bar_id integer, error_message text, detalhes jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$function$$
BEGIN
  -- 1. Jobs STALE: última execução bem-sucedida há muito tempo
  RETURN QUERY
  WITH ultima_execucao_sucesso AS (
    SELECT DISTINCT ON (h.job_name)
      h.job_name,
      h.started_at,
      h.finished_at,
      h.status,
      h.bar_id
    FROM cron_heartbeats h
    WHERE h.status IN ('success', 'partial')
    ORDER BY h.job_name, h.started_at DESC
  )
  SELECT 
    ue.job_name,
    'stale'::TEXT as tipo_problema,
    ue.status,
    EXTRACT(EPOCH FROM (NOW() - ue.finished_at))::INTEGER / 60 as tempo_sem_execucao_minutos,
    ue.finished_at as ultima_execucao,
    ue.bar_id,
    NULL::TEXT as error_message,
    jsonb_build_object(
      'ultima_execucao_sucesso', ue.finished_at,
      'minutos_desde_ultima', EXTRACT(EPOCH FROM (NOW() - ue.finished_at))::INTEGER / 60
    ) as detalhes
  FROM ultima_execucao_sucesso ue
  WHERE ue.finished_at < NOW() - (p_stale_minutes || ' minutes')::INTERVAL;

  -- 2. Jobs STUCK: status = 'running' há muito tempo
  RETURN QUERY
  SELECT 
    h.job_name,
    'stuck'::TEXT as tipo_problema,
    h.status,
    EXTRACT(EPOCH FROM (NOW() - h.started_at))::INTEGER / 60 as tempo_sem_execucao_minutos,
    h.started_at as ultima_execucao,
    h.bar_id,
    NULL::TEXT as error_message,
    jsonb_build_object(
      'iniciado_em', h.started_at,
      'minutos_travado', EXTRACT(EPOCH FROM (NOW() - h.started_at))::INTEGER / 60
    ) as detalhes
  FROM cron_heartbeats h
  WHERE h.status = 'running'
    AND h.started_at < NOW() - (p_stuck_minutes || ' minutes')::INTERVAL;

  -- 3. Jobs com ERROR recente
  RETURN QUERY
  SELECT 
    h.job_name,
    'error'::TEXT as tipo_problema,
    h.status,
    EXTRACT(EPOCH FROM (NOW() - h.finished_at))::INTEGER / 60 as tempo_sem_execucao_minutos,
    h.finished_at as ultima_execucao,
    h.bar_id,
    h.error_message,
    jsonb_build_object(
      'erro_em', h.finished_at,
      'duracao_ms', h.duration_ms,
      'response_summary', h.response_summary
    ) as detalhes
  FROM cron_heartbeats h
  WHERE h.status = 'error'
    AND h.finished_at > NOW() - (p_error_hours || ' hours')::INTERVAL
  ORDER BY h.finished_at DESC;

END;
$$function$$;
