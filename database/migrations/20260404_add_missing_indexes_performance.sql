-- Migration: Adicionar índices faltantes para melhorar performance
-- Data: 04/04/2026
-- Objetivo: Reduzir sequential scans em tabelas com alto volume de consultas

-- ============================================================
-- 1. checklist_automation_logs (0.2% index usage - CRÍTICO)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_checklist_automation_logs_criado_em
  ON checklist_automation_logs (criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_automation_logs_tipo
  ON checklist_automation_logs (tipo);

CREATE INDEX IF NOT EXISTS idx_checklist_automation_logs_schedule
  ON checklist_automation_logs (checklist_schedule_id);

-- ============================================================
-- 2. audit_trail (25.8% index usage)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at
  ON audit_trail (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_trail_bar_id
  ON audit_trail (bar_id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_user_operation
  ON audit_trail (user_id, operation);

CREATE INDEX IF NOT EXISTS idx_audit_trail_table_record
  ON audit_trail (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp
  ON audit_trail (timestamp DESC);

-- ============================================================
-- 3. checklist_agendamentos (44.1% index usage)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_checklist_agendamentos_bar_data
  ON checklist_agendamentos (bar_id, data_agendada);

CREATE INDEX IF NOT EXISTS idx_checklist_agendamentos_status
  ON checklist_agendamentos (status, bar_id);

CREATE INDEX IF NOT EXISTS idx_checklist_agendamentos_deadline
  ON checklist_agendamentos (deadline DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_agendamentos_responsavel
  ON checklist_agendamentos (responsavel_id, status);

-- ============================================================
-- 4. getin_reservations (85.5% mas 140K seq scans)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_getin_reservations_bar_date
  ON getin_reservations (bar_id, reservation_date);

CREATE INDEX IF NOT EXISTS idx_getin_reservations_status
  ON getin_reservations (status, bar_id);

CREATE INDEX IF NOT EXISTS idx_getin_reservations_customer_email
  ON getin_reservations (customer_email);

CREATE INDEX IF NOT EXISTS idx_getin_reservations_created_at
  ON getin_reservations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_getin_reservations_reservation_id
  ON getin_reservations (reservation_id);

-- ============================================================
-- VALIDAÇÃO
-- ============================================================

-- Verificar índices criados
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'checklist_automation_logs', 
  'audit_trail', 
  'checklist_agendamentos', 
  'getin_reservations'
)
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
