-- Rollback de 2026-04-25-sec02-multi-tenancy-fix.sql.
--
-- ⚠️⚠️⚠️ ATENCAO ⚠️⚠️⚠️
-- ESTE ROLLBACK RE-ABRE VAZAMENTO CROSS-TENANT EM 6 TABELAS:
--   - 3 tabelas Bucket A (bronze_contahub_raw_data, orcamentacao, automation_logs)
--     voltam a permitir que qualquer authenticated leia dados de qualquer bar.
--   - 1 tabela Bucket B (uploads) volta a permitir que qualquer authenticated
--     leia/manipule uploads de qualquer outro usuario.
--   - 2 tabelas Bucket C (semanas_referencia, execucoes_automaticas) voltam
--     a expor logs system-level a authenticated (mesmo padrao corrigido no PR #13).
--
-- Smoke-before com este vazamento: 5622 rows abrangendo 2 bars distintos
-- (Ordinario + Deboche) visiveis a qualquer authenticated em
-- bronze.bronze_contahub_raw_data.
--
-- SO EXECUTAR ESTE ROLLBACK SE:
--   1. A migration forward causou regressao funcional confirmada por smoke-test, E
--   2. Existe plano de re-fix imediato (horas, nao dias).
--
-- Recreia policies originais com qual/with_check fiel ao snapshot
-- _advisor_snapshots/2026-04-25-sec02-smoke-before.json (estado pre-apply).

-- ============================================
-- Fix #1 reversal — bronze.bronze_contahub_raw_data
-- ============================================
ALTER POLICY "contahub_raw_data_policy" ON "bronze"."bronze_contahub_raw_data"
  USING (((select auth.role()) = 'authenticated'::text));

-- ============================================
-- Fix #2 reversal — financial.orcamentacao
-- ============================================
ALTER POLICY "orcamentacao_policy" ON "financial"."orcamentacao"
  USING (((select auth.role()) = 'authenticated'::text));

-- ============================================
-- Fix #3 reversal — system.automation_logs
-- ============================================
ALTER POLICY "automation_logs_policy" ON "system"."automation_logs"
  USING (((select auth.role()) = 'authenticated'::text));

-- ============================================
-- Fix #4 reversal — system.uploads
-- ============================================
ALTER POLICY "Usuário gerencia uploads" ON "system"."uploads"
  USING (((select auth.role()) = 'authenticated'::text));

-- ============================================
-- Fix #5 reversal — meta.semanas_referencia
-- Reverte DROP+CREATE: dropa a SELECT-only criada, recreia a cmd=ALL aberta.
-- ============================================
DROP POLICY IF EXISTS "semanas_referencia_select" ON "meta"."semanas_referencia";

CREATE POLICY "semanas_referencia_policy" ON "meta"."semanas_referencia"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.uid()) IS NOT NULL));

-- ============================================
-- Fix #6 reversal — system.execucoes_automaticas
-- Recria policy ALL pra authenticated.
-- ============================================
CREATE POLICY "execucoes_automaticas_policy" ON "system"."execucoes_automaticas"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (((select auth.uid()) IS NOT NULL));
