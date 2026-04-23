-- Migration: 2026-04-23-deprecate-desempenho-manual-backup-20260423
-- Contexto: Etapa 3 (exclusao legacy). Snapshot mais recente de meta.desempenho_manual
-- feito em 2026-04-23 (208 rows / 344 kB). Sem referencias em codigo de runtime.
-- Soft-deprecate de 2026-04-23 a 2026-05-01.
--
-- Rollback:
--   DROP VIEW IF EXISTS meta.desempenho_manual_backup_20260423_deprecated;
--   COMMENT ON TABLE meta.desempenho_manual_backup_20260423 IS NULL;

COMMENT ON TABLE meta.desempenho_manual_backup_20260423 IS
  'DEPRECATED since 2026-04-23. Drop scheduled 2026-05-01. Snapshot sem referencias em codigo de runtime.';

CREATE OR REPLACE VIEW meta.desempenho_manual_backup_20260423_deprecated AS
  SELECT * FROM meta.desempenho_manual_backup_20260423;

COMMENT ON VIEW meta.desempenho_manual_backup_20260423_deprecated IS
  'Alias de observacao. Drop apos 2026-05-01.';
