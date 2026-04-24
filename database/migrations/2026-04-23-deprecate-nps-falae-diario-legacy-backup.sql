-- Migration: 2026-04-23-deprecate-nps-falae-diario-legacy-backup
-- Contexto: Etapa 3 (exclusao legacy). Backup historico (37 rows / 96 kB).
-- Soft-deprecate de 2026-04-23 a 2026-05-01.
--
-- Rollback:
--   DROP VIEW IF EXISTS crm.nps_falae_diario_legacy_backup_deprecated;
--   COMMENT ON TABLE crm.nps_falae_diario_legacy_backup IS NULL;

COMMENT ON TABLE crm.nps_falae_diario_legacy_backup IS
  'DEPRECATED since 2026-04-23. Drop scheduled 2026-05-01. Backup historico sem referencias em codigo de runtime.';

CREATE OR REPLACE VIEW crm.nps_falae_diario_legacy_backup_deprecated AS
  SELECT * FROM crm.nps_falae_diario_legacy_backup;

COMMENT ON VIEW crm.nps_falae_diario_legacy_backup_deprecated IS
  'Alias de observacao. Drop apos 2026-05-01.';
