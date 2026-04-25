-- Fecha 3 leaks SELECT acessiveis a `anon` em policies com
-- roles=public e qual=true.
-- Auditoria: database/_advisor_snapshots/2026-04-24-sec-public-true-audit.md
--
-- Vazamento confirmado em prod via smoke-before:
--   operations.bares                       — anon le 2 rows (CNPJ + endereco)
--   system.system_logs                     — anon le 15 rows (logs internos)
--   operations.checklist_automation_logs   — anon le 0 rows (vazia, mas policy aberta)
--
-- Premissa critica (verificada na Fase 3):
--   service_role tem rolbypassrls=TRUE — DROP/ALTER abaixo nao afeta service_role,
--   que continua acessando irrestrito via bypass nativo.
--
-- Pre-flight Fix #1 (operations.bares):
--   9 call-sites em frontend/src/app/api/* — todos server-side, todos
--   getAdminClient() ou createClient(SUPABASE_SERVICE_ROLE_KEY).
--   Nenhuma query browser-side a operations.bares (login/page.tsx so referencia
--   "bares" em texto de footer). Restricao para auth.uid() IS NOT NULL e
--   100% segura — service_role bypassa, authenticated continua passando.

-- ============================================
-- Fix #1: operations.bares :: bars_select_policy
-- ALTER pra restringir leitura a usuarios autenticados.
-- (select auth.uid()) IS NOT NULL = mantem o estilo InitPlan-friendly da Fase 2.
-- ============================================
ALTER POLICY "bars_select_policy" ON "operations"."bares"
  USING (((select auth.uid()) IS NOT NULL));

-- ============================================
-- Fix #2: system.system_logs :: system_logs_select
-- DROP. service_role bypassa. Authenticated nao tem motivo pra ler logs internos
-- (nao ha rota frontend autenticada lendo system_logs; service_role-only).
-- ============================================
DROP POLICY IF EXISTS "system_logs_select" ON "system"."system_logs";

-- ============================================
-- Fix #3: operations.checklist_automation_logs :: checklist_logs_select
-- DROP. Mesma justificativa do #2 — logs de automacao sao para service_role.
-- ============================================
DROP POLICY IF EXISTS "checklist_logs_select" ON "operations"."checklist_automation_logs";
