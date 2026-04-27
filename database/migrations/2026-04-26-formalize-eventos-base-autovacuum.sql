-- B.3 — Formalizar tuning out-of-band em operations.eventos_base (#40 follow-up)
--
-- CONTEXTO
-- ========
-- Reloptions de autovacuum em operations.eventos_base foram aplicadas out-of-band
-- (sem migration registrada). Descoberto durante perf/04 (autovacuum_tuning) e
-- documentado em docs/investigations/2026-04-eventos-base-out-of-band.md.
--
-- ESTADO PRÉ E PÓS-APLY (devem ser idênticos)
-- ===========================================
-- pg_class.reloptions já contém:
--   autovacuum_vacuum_threshold      = 50
--   autovacuum_vacuum_scale_factor   = 0.05
--   autovacuum_analyze_scale_factor  = 0.02
--
-- Os mesmos valores que perf/04 (PR #14) aplicou em silver.cliente_visitas
-- e silver.tempos_producao via migration registrada.
--
-- POR QUE ESTA MIGRATION
-- ======================
-- Este SET é operacionalmente NO-OP (valores idênticos), mas registra a INTENÇÃO
-- e a justificativa no histórico de migrations. Próxima auditoria não vai
-- redescobrir "do zero" o que já foi decidido.
--
-- Regra que está sendo reforçada (database/CONVENTIONS.md, seção nova):
-- toda mudança de schema (incluindo SET reloptions) DEVE ser via migration.
-- Out-of-band DDL é dívida arquitetural silenciosa.

ALTER TABLE operations.eventos_base SET (
  autovacuum_vacuum_threshold     = 50,
  autovacuum_vacuum_scale_factor  = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- Validação pós-apply: os 3 reloptions abaixo devem aparecer (mesmos valores).
-- SELECT relname, reloptions FROM pg_class
-- WHERE relnamespace = 'operations'::regnamespace AND relname = 'eventos_base';
