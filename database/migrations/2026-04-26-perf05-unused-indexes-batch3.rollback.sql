-- ROLLBACK perf/05 batch 3 — operations + financial unused_indexes
-- Recria os 13 índices na configuração exata pré-DROP (extraída de pg_indexes em 2026-04-26).
-- Aplicar com CONCURRENTLY pra não bloquear writes em produção.

-- 1. operations.eventos_base — partial WHERE conta_assinada > 0
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eventos_base_conta_assinada
  ON operations.eventos_base USING btree (conta_assinada)
  WHERE (conta_assinada > (0)::numeric);

-- 2. operations.checklist_agendamentos — (bar_id, data_agendada)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_agendamentos_bar_data
  ON operations.checklist_agendamentos USING btree (bar_id, data_agendada);

-- 3. operations.checklist_agendamentos — (deadline DESC)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_agendamentos_deadline
  ON operations.checklist_agendamentos USING btree (deadline DESC);

-- 4. operations.eventos_base — partial WHERE cancelamentos > 0
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eventos_base_cancelamentos
  ON operations.eventos_base USING btree (cancelamentos)
  WHERE (cancelamentos > (0)::numeric);

-- 5. operations.checklist_automation_logs — (checklist_schedule_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_automation_logs_schedule
  ON operations.checklist_automation_logs USING btree (checklist_schedule_id);

-- 6. operations.checklist_automation_logs — (checklist_auto_execution_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_automation_logs_execution_id
  ON operations.checklist_automation_logs USING btree (checklist_auto_execution_id);

-- 7. operations.checklist_agendamentos — (status, bar_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_agendamentos_status
  ON operations.checklist_agendamentos USING btree (status, bar_id);

-- 8. operations.checklist_agendamentos — (responsavel_id, status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_agendamentos_responsavel
  ON operations.checklist_agendamentos USING btree (responsavel_id, status);

-- 9. operations.checklist_automation_logs — (tipo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checklist_automation_logs_tipo
  ON operations.checklist_automation_logs USING btree (tipo);

-- 10. operations.config_metas_planejamento — (bar_id, ano)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_config_metas_bar_ano
  ON operations.config_metas_planejamento USING btree (bar_id, ano);

-- 11. operations.bares_config — (bar_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bares_config_bar_id
  ON operations.bares_config USING btree (bar_id);

-- 12. operations.bar_local_mapeamento — (bar_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bar_local_mapeamento_bar_id
  ON operations.bar_local_mapeamento USING btree (bar_id);

-- 13. operations.bar_local_mapeamento — (categoria)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bar_local_mapeamento_categoria
  ON operations.bar_local_mapeamento USING btree (categoria);
