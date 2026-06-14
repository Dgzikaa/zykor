-- 2026-06-14 — PILOTO (task #42 Fase 2): escopo-por-bar em RLS de tabela multi-tenant.
-- Antes: silver.cliente_visitas tinha policy authenticated USING(true) → QUALQUER usuário
-- logado lia clientes (PII) de TODOS os bares direto no PostgREST. Verificado: usuário
-- só-do-bar-3 enxergava bar 3 (198.195) E bar 4 (61.091).
-- Depois: USING(user_has_bar_access(bar_id)) → vê só os bares do seu usuarios_bares.
-- Testado simulando JWT autenticado (SET request.jwt.claims): passou a ver só o bar 3.
-- service_role (API routes do app) não é afetado (policy service_all USING(true) intacta).
-- Mapeamento auth.uid() ↔ usuarios_bares.usuario_id validado 100% (42/42).
--
-- Este é o TEMPLATE pro rollout das demais tabelas com bar_id (task #42).
-- Rollback: ALTER POLICY auth_select ON silver.cliente_visitas USING (true);

ALTER POLICY auth_select ON silver.cliente_visitas USING (user_has_bar_access(bar_id));
