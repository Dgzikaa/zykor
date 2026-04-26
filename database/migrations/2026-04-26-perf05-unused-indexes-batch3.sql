-- perf/05 batch 3 — operations + financial unused_indexes
-- Drops 13 indexes flagged como unused_index (idx_scan = 0 em janela de 87 dias).
-- Audit 4 vetores: grep código, composite check, pg_stat_statements, idx_scan/last_idx_scan.
--
-- Insights:
--   * idx_eventos_base_conta_assinada (1.5 MB, parcial WHERE conta_assinada > 0):
--     feature está ativa (35 hits no grep), mas WHERE filter nunca foi usado.
--     Index criado fora do controle de migrations (sem rastro no git).
--   * idx_eventos_base_cancelamentos: mesmo padrão, parcial nunca filtrado.
--   * idx_bares_config_bar_id: DUPLICATE de UNIQUE bares_config_bar_id_key.
--   * idx_config_metas_bar_ano: DUPLICATE de UNIQUE uq_config_metas_bar_ano.
--   * idx_bar_local_mapeamento_bar_id: prefix-cobertura de UNIQUE (bar_id, categoria).
--   * checklist_agendamentos compostos (4): nenhum query filtra (bar_id,data_agendada),
--     (deadline DESC), (status,bar_id) ou (responsavel_id,status). Cobertos por
--     idx_checklist_agendamentos_bar e idx_checklist_agendamentos_data.
--   * checklist_automation_logs (3): tabela 100% append-only, INSERTs nunca consultam
--     checklist_schedule_id, checklist_auto_execution_id ou tipo via WHERE.
--   * financial schema: 0 candidatos pós-pre-flight (nenhum index com idx_scan=0).
--
-- Apply mode: DROP INDEX CONCURRENTLY (não pode rodar dentro de transação).
-- Cada DROP aplicado individualmente via execute_sql, não apply_migration.

-- 1. operations.eventos_base — partial WHERE conta_assinada > 0 (1.5 MB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_eventos_base_conta_assinada;

-- 2. operations.checklist_agendamentos — (bar_id, data_agendada) (208 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_checklist_agendamentos_bar_data;

-- 3. operations.checklist_agendamentos — (deadline DESC) (152 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_checklist_agendamentos_deadline;

-- 4. operations.eventos_base — partial WHERE cancelamentos > 0 (104 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_eventos_base_cancelamentos;

-- 5. operations.checklist_automation_logs — (checklist_schedule_id) (64 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_checklist_automation_logs_schedule;

-- 6. operations.checklist_automation_logs — (checklist_auto_execution_id) (64 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_checklist_automation_logs_execution_id;

-- 7. operations.checklist_agendamentos — (status, bar_id) (64 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_checklist_agendamentos_status;

-- 8. operations.checklist_agendamentos — (responsavel_id, status) (64 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_checklist_agendamentos_responsavel;

-- 9. operations.checklist_automation_logs — (tipo) (64 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_checklist_automation_logs_tipo;

-- 10. operations.config_metas_planejamento — DUPLICATE de uq_config_metas_bar_ano (16 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_config_metas_bar_ano;

-- 11. operations.bares_config — DUPLICATE de bares_config_bar_id_key (16 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_bares_config_bar_id;

-- 12. operations.bar_local_mapeamento — prefix de bar_local_mapeamento_bar_id_categoria_key (16 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_bar_local_mapeamento_bar_id;

-- 13. operations.bar_local_mapeamento — (categoria) standalone, nunca filtrado (16 kB)
DROP INDEX CONCURRENTLY IF EXISTS operations.idx_bar_local_mapeamento_categoria;

-- Total esperado liberado: ~2.3 MB
-- Pós-DROP: VACUUM ANALYZE em 6 tabelas afetadas.
