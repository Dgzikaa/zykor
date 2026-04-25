-- Rollback de 2026-04-25-perf04-autovacuum-tuning.sql.
-- RESET volta os 2 parametros pros defaults do cluster (0.2 / 0.1).
--
-- Baseline pre-fix (capturado em 2026-04-25):
--   silver.cliente_visitas reloptions = NULL  -> RESET equivale ao estado original.
--   silver.tempos_producao reloptions = NULL  -> idem.
--
-- Aplicar APENAS se observarmos comportamento adverso em prod (autovacuum
-- saturando I/O, etc). Validacao 24h-72h dos novos valores e pre-requisito.

ALTER TABLE silver.cliente_visitas RESET (
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);

ALTER TABLE silver.tempos_producao RESET (
  autovacuum_vacuum_scale_factor,
  autovacuum_analyze_scale_factor
);
