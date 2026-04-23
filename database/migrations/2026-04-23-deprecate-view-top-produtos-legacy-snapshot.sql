-- Migration: 2026-04-23-deprecate-view-top-produtos-legacy-snapshot
-- Contexto: Etapa 3 (exclusao legacy). Tabela com nome "view_..._snapshot" sugere
-- snapshot antigo de uma view materializada (200 rows / 264 kB).
-- Sem referencias em codigo de runtime.
-- Soft-deprecate de 2026-04-23 a 2026-05-01.
--
-- Rollback:
--   DROP VIEW IF EXISTS public.view_top_produtos_legacy_snapshot_deprecated;
--   COMMENT ON TABLE public.view_top_produtos_legacy_snapshot IS NULL;

COMMENT ON TABLE public.view_top_produtos_legacy_snapshot IS
  'DEPRECATED since 2026-04-23. Drop scheduled 2026-05-01. Snapshot legacy sem referencias em codigo de runtime.';

CREATE OR REPLACE VIEW public.view_top_produtos_legacy_snapshot_deprecated AS
  SELECT * FROM public.view_top_produtos_legacy_snapshot;

COMMENT ON VIEW public.view_top_produtos_legacy_snapshot_deprecated IS
  'Alias de observacao. Drop apos 2026-05-01.';
