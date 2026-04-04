-- ============================================================================
-- ADVISORY LOCKS PARA JOBS
-- ============================================================================
-- Previne execuções simultâneas de cron jobs usando advisory locks do Postgres
-- Criado em: 2026-04-04
-- ============================================================================

-- Função para adquirir lock de job
-- Retorna TRUE se conseguiu o lock, FALSE se já está em execução
CREATE OR REPLACE FUNCTION acquire_job_lock(job_name TEXT, timeout_minutes INT DEFAULT 30)
RETURNS BOOLEAN AS $$
DECLARE
  lock_id BIGINT;
  existing_lock RECORD;
BEGIN
  -- Gera um ID numérico consistente a partir do nome do job
  lock_id := hashtext(job_name);

  -- Verifica se já tem um lock ativo (proteção contra locks órfãos)
  SELECT * INTO existing_lock FROM cron_heartbeats
  WHERE job_name = acquire_job_lock.job_name
  AND status = 'running'
  AND started_at > NOW() - (timeout_minutes || ' minutes')::INTERVAL;

  IF FOUND THEN
    RETURN FALSE; -- Já tem execução em andamento
  END IF;

  -- Tenta adquirir advisory lock (não bloqueante)
  RETURN pg_try_advisory_lock(lock_id);
END;
$$ LANGUAGE plpgsql;

-- Função para liberar lock de job
CREATE OR REPLACE FUNCTION release_job_lock(job_name TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM pg_advisory_unlock(hashtext(job_name));
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON FUNCTION acquire_job_lock(TEXT, INT) IS 
'Adquire advisory lock para prevenir execuções simultâneas de jobs. Retorna TRUE se conseguiu o lock, FALSE se já está rodando.';

COMMENT ON FUNCTION release_job_lock(TEXT) IS 
'Libera advisory lock de um job após conclusão da execução.';
