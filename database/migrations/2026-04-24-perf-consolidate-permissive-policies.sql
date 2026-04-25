-- DROP de 9 policies service_role_full_* redundantes apontadas pelo
-- Supabase Performance Advisor (multiple_permissive_policies).
-- Baseline: database/_advisor_snapshots/2026-04-24-perf-after-02.json (66 findings)
-- Pre-flight: database/_advisor_snapshots/2026-04-24-multiple-permissive-preflight.md
--
-- Premissa critica: service_role tem rolbypassrls=TRUE no Postgres deste projeto
-- (verificado via pg_roles em 2026-04-24). As policies removidas eram no-ops:
--   - 7 com USING (auth.role()='service_role'): no-op total para service_role
--     (que ja bypassa RLS nativamente).
--   - 2 com USING (true) + roles={public}: BUG DE SEGURANCA (vazava SELECT
--     pra anon e outros roles publicos); DROP fecha o furo. service_role
--     continua acessando via BYPASSRLS.
--
-- Bucket C (2 tabelas) adiado: operations.config_metas_planejamento e
-- ops.job_camada_mapping tem read/write split com cmds diferentes — fix
-- nao-trivial sem write-tests dedicados. Reavaliar em PR futuro.

-- ============================================
-- crm.crm_segmentacao
-- (USING auth.role()='service_role' — redundante)
-- ============================================
DROP POLICY IF EXISTS "service_role_full_crm_segmentacao" ON "crm"."crm_segmentacao";

-- ============================================
-- crm.nps_falae_diario_legacy_backup
-- (USING auth.role()='service_role' — redundante)
-- ============================================
DROP POLICY IF EXISTS "service_role_full_nps_falae_diario" ON "crm"."nps_falae_diario_legacy_backup";

-- ============================================
-- crm.nps_falae_diario_pesquisa
-- (USING auth.role()='service_role' — redundante)
-- ============================================
DROP POLICY IF EXISTS "service_role_full_nps_falae_diario_pesquisa" ON "crm"."nps_falae_diario_pesquisa";

-- ============================================
-- financial.cmv_mensal
-- (USING auth.role()='service_role' — redundante)
-- ============================================
DROP POLICY IF EXISTS "service_role_full_cmv_mensal" ON "financial"."cmv_mensal";

-- ============================================
-- integrations.contaazul_categorias
-- ⚠️ BUG SEGURANCA: USING (true) + roles={public} — vazava SELECT pra anon.
-- DROP fecha o furo. service_role acessa via BYPASSRLS.
-- ============================================
DROP POLICY IF EXISTS "service_role_full_access" ON "integrations"."contaazul_categorias";

-- ============================================
-- integrations.contaazul_centros_custo
-- ⚠️ BUG SEGURANCA: USING (true) + roles={public} — vazava SELECT pra anon.
-- DROP fecha o furo. service_role acessa via BYPASSRLS.
-- ============================================
DROP POLICY IF EXISTS "service_role_full_access" ON "integrations"."contaazul_centros_custo";

-- ============================================
-- meta.metas_desempenho_historico
-- (USING auth.role()='service_role' — redundante)
-- ============================================
DROP POLICY IF EXISTS "service_role_full_metas_desempenho_historico" ON "meta"."metas_desempenho_historico";

-- ============================================
-- system.sync_contagem_historico
-- (USING auth.role()='service_role' — redundante)
-- ============================================
DROP POLICY IF EXISTS "service_role_full_sync_contagem_historico" ON "system"."sync_contagem_historico";

-- ============================================
-- system.sync_metadata
-- (USING auth.role()='service_role' — redundante)
-- ============================================
DROP POLICY IF EXISTS "service_role_full_sync_metadata" ON "system"."sync_metadata";
