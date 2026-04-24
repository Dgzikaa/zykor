-- Migration: 2026-04-23-deprecate-cliente-perfil-consumo-legacy-backup
-- Contexto: Etapa 3 (exclusao legacy). Tabela backup sem referencias em codigo
-- de runtime (104k rows / 176 MB). Soft-deprecate de 2026-04-23 a 2026-05-01.
--
-- Rollback:
--   DROP VIEW IF EXISTS crm.cliente_perfil_consumo_legacy_backup_DEPRECATED;
--   COMMENT ON TABLE crm.cliente_perfil_consumo_legacy_backup IS NULL;
--
-- Drop efetivo em migration posterior (>= 2026-05-01).

COMMENT ON TABLE crm.cliente_perfil_consumo_legacy_backup IS
  'DEPRECATED since 2026-04-23. Drop scheduled 2026-05-01. Backup historico sem referencias em codigo de runtime (verificado via grep em frontend/ backend/ database/functions/ scripts/).';

CREATE OR REPLACE VIEW crm.cliente_perfil_consumo_legacy_backup_deprecated AS
  SELECT * FROM crm.cliente_perfil_consumo_legacy_backup;

COMMENT ON VIEW crm.cliente_perfil_consumo_legacy_backup_deprecated IS
  'Alias de observacao. Se alguem reclamar, da pra reintroduzir a tabela original. Drop apos 2026-05-01.';
