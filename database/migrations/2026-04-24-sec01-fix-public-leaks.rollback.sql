-- Rollback de 2026-04-24-sec01-fix-public-leaks.sql.
--
-- ⚠️ ATENCAO — ESTE ROLLBACK RE-ABRE 3 LEAKS DE SEGURANCA DOCUMENTADOS:
--   1. operations.bares: anon volta a ler CNPJ + endereco dos 2 bares.
--   2. system.system_logs: anon volta a ler logs internos do sistema (15+ rows).
--   3. operations.checklist_automation_logs: anon volta a ler logs de automacao
--      assim que tabela for populada.
--
-- Aplicar APENAS se a migration forward causou regressao funcional comprovada
-- por smoke-test e ja foi reportada ao time. Nao usar em rollback automatico.

-- ============================================
-- Fix #1 reversal: operations.bares
-- Restaura USING (true) — re-abre leak.
-- ============================================
ALTER POLICY "bars_select_policy" ON "operations"."bares"
  USING (true);

-- ============================================
-- Fix #2 reversal: system.system_logs
-- Recria policy SELECT publica — re-abre leak.
-- ============================================
CREATE POLICY "system_logs_select"
  ON "system"."system_logs"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);

-- ============================================
-- Fix #3 reversal: operations.checklist_automation_logs
-- Recria policy SELECT publica — re-abre leak.
-- ============================================
CREATE POLICY "checklist_logs_select"
  ON "operations"."checklist_automation_logs"
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);
