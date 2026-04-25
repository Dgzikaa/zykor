-- Rollback de 2026-04-24-perf-consolidate-permissive-policies.sql.
-- Recria as 9 policies dropadas com qual/with_check fiel ao snapshot
-- database/_advisor_snapshots/2026-04-24-pg-policies-post-fase2.json.
--
-- ATENCAO: este rollback recria policies que permitiam `anon` SELECT em
-- integrations.contaazul_categorias e integrations.contaazul_centros_custo
-- (USING true + roles=public, bug de seguranca pre-existente).
-- Aplicar APENAS se a migration forward causou regressao funcional comprovada.

-- ============================================
-- crm.crm_segmentacao
-- ============================================
CREATE POLICY "service_role_full_crm_segmentacao"
  ON "crm"."crm_segmentacao"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.role()) = 'service_role'::text));

-- ============================================
-- crm.nps_falae_diario_legacy_backup
-- ============================================
CREATE POLICY "service_role_full_nps_falae_diario"
  ON "crm"."nps_falae_diario_legacy_backup"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.role()) = 'service_role'::text));

-- ============================================
-- crm.nps_falae_diario_pesquisa
-- ============================================
CREATE POLICY "service_role_full_nps_falae_diario_pesquisa"
  ON "crm"."nps_falae_diario_pesquisa"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.role()) = 'service_role'::text));

-- ============================================
-- financial.cmv_mensal
-- ============================================
CREATE POLICY "service_role_full_cmv_mensal"
  ON "financial"."cmv_mensal"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.role()) = 'service_role'::text));

-- ============================================
-- integrations.contaazul_categorias  ⚠️ RE-ABRE BUG
-- ============================================
CREATE POLICY "service_role_full_access"
  ON "integrations"."contaazul_categorias"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ============================================
-- integrations.contaazul_centros_custo  ⚠️ RE-ABRE BUG
-- ============================================
CREATE POLICY "service_role_full_access"
  ON "integrations"."contaazul_centros_custo"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ============================================
-- meta.metas_desempenho_historico
-- ============================================
CREATE POLICY "service_role_full_metas_desempenho_historico"
  ON "meta"."metas_desempenho_historico"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.role()) = 'service_role'::text));

-- ============================================
-- system.sync_contagem_historico
-- ============================================
CREATE POLICY "service_role_full_sync_contagem_historico"
  ON "system"."sync_contagem_historico"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.role()) = 'service_role'::text));

-- ============================================
-- system.sync_metadata
-- ============================================
CREATE POLICY "service_role_full_sync_metadata"
  ON "system"."sync_metadata"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.role()) = 'service_role'::text));
