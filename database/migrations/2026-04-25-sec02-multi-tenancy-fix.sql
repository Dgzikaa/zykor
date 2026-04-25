-- Fecha vazamento cross-tenant em 6 tabelas com policies authenticated cmd=ALL
-- sem filtro de bar_id ou owner. Auditoria descobriu durante sec/01.
--
-- Leak ativo confirmado por smoke-before:
--   bronze.bronze_contahub_raw_data: 5622 rows, 2 bars distintos visiveis a
--     qualquer authenticated. Ordinario (bar=3) e Deboche (bar=4) viam dados
--     um do outro.
--
-- Smoke-before: database/_advisor_snapshots/2026-04-25-sec02-smoke-before.json
--
-- ESCOPO (6 tabelas, 5 fixes distintos):
--   Bucket A (3 ALTER POLICY com user_has_bar_access(bar_id)):
--     bronze.bronze_contahub_raw_data
--     financial.orcamentacao
--     system.automation_logs
--   Bucket B (1 ALTER POLICY com uploaded_by = auth.uid()):
--     system.uploads
--   Bucket C (1 DROP+CREATE + 1 DROP):
--     meta.semanas_referencia      — DROP cmd=ALL + CREATE SELECT-only authenticated
--     system.execucoes_automaticas — DROP authenticated (service_role bypass mantem)
--
-- FORA DO ESCOPO:
--   financial.dre_manual: 82 rows com bar_id IS NULL. Aplicar policy estrita
--     deixaria todas invisiveis pra authenticated (regressao de UI). Tracked
--     como task #43 — backfill bar_id antes de RLS.
--
-- HELPER usado (public.user_has_bar_access(check_bar_id integer)):
--   STABLE SECURITY DEFINER LANGUAGE sql, retorna EXISTS check em
--   public.usuarios_bares. Planner consegue inlinar. Internamente usa
--   auth.uid() sem wrap (select auth.uid()) — otimizacao do helper para
--   InitPlan-friendly e task separada (#42), fora do escopo deste PR.
--   Coexiste com duplicata user_has_access_to_bar — task #42 normaliza.
--
-- Validacao: smoke-after compara counts/bars-distintos por UUID bar=3 vs
-- UUID bar=4 vs service_role. Esperado:
--   - Bucket A: cada UUID ve so seu bar (count cai pra subset, distinct_bars=1).
--   - Bucket B: ambos UUIDs veem 0 (tabela vazia hoje).
--   - meta.semanas_referencia: ambos leem 48 (calendario global mantido).
--   - execucoes_automaticas: authenticated cai pra 0; service_role mantem 439.

-- ============================================
-- Fix #1 (Bucket A) — bronze.bronze_contahub_raw_data
-- ============================================
ALTER POLICY "contahub_raw_data_policy" ON "bronze"."bronze_contahub_raw_data"
  USING (public.user_has_bar_access(bar_id));

-- ============================================
-- Fix #2 (Bucket A) — financial.orcamentacao
-- ============================================
ALTER POLICY "orcamentacao_policy" ON "financial"."orcamentacao"
  USING (public.user_has_bar_access(bar_id));

-- ============================================
-- Fix #3 (Bucket A) — system.automation_logs
-- ============================================
ALTER POLICY "automation_logs_policy" ON "system"."automation_logs"
  USING (public.user_has_bar_access(bar_id));

-- ============================================
-- Fix #4 (Bucket B) — system.uploads
-- ============================================
ALTER POLICY "Usuário gerencia uploads" ON "system"."uploads"
  USING (uploaded_by = (select auth.uid()));

-- ============================================
-- Fix #5 (Bucket C) — meta.semanas_referencia
-- DROP cmd=ALL com qual aberto, CREATE SELECT-only authenticated.
-- Calendario ISO compartilhado eh dado intencionalmente publico entre os
-- 2 bares (48 rows). Service_role mantem ALL via BYPASSRLS.
-- ============================================
DROP POLICY IF EXISTS "semanas_referencia_policy" ON "meta"."semanas_referencia";

CREATE POLICY "semanas_referencia_select" ON "meta"."semanas_referencia"
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- Fix #6 (Bucket C) — system.execucoes_automaticas
-- DROP. service_role tem rolbypassrls=TRUE, nao precisa de policy explicita.
-- Pre-flight (sub-gate 1.5): 0 queries no frontend (so type-defs em
-- supabase.ts e table-schemas.ts). Mesmo padrao do system.system_logs no
-- PR #13.
-- ============================================
DROP POLICY IF EXISTS "execucoes_automaticas_policy" ON "system"."execucoes_automaticas";
