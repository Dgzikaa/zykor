-- Migration: 2026-04-23-deprecate-desempenho-manual-backup-20260422-v2
-- Contexto: Etapa 3 (exclusao legacy). Snapshot de meta.desempenho_manual
-- feito em 2026-04-22 v2 antes do fix ETL v3 (208 rows / 352 kB).
-- Ver database/migrations/2026-04-22-fix-etl-desempenho-semanal-v3.sql:7.
-- Soft-deprecate de 2026-04-23 a 2026-05-01.
--
-- Rollback:
--   DROP VIEW IF EXISTS meta.desempenho_manual_backup_20260422_v2_deprecated;
--   COMMENT ON TABLE meta.desempenho_manual_backup_20260422_v2 IS NULL;

COMMENT ON TABLE meta.desempenho_manual_backup_20260422_v2 IS
  'DEPRECATED since 2026-04-23. Drop scheduled 2026-05-01. Snapshot pre-fix ETL v3 - funcao ja cumprida.';

CREATE OR REPLACE VIEW meta.desempenho_manual_backup_20260422_v2_deprecated AS
  SELECT * FROM meta.desempenho_manual_backup_20260422_v2;

COMMENT ON VIEW meta.desempenho_manual_backup_20260422_v2_deprecated IS
  'Alias de observacao. Drop apos 2026-05-01.';
