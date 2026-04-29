-- sec/03 — Fechar policy aberta de financial.dre_manual com proteção em camadas.
--
-- CONTEXTO
-- 82 rows legacy com bar_id IS NULL importadas em batch via CSV em
-- 2025-09-07 14:47:29 (usuario_criacao = 'import_csv'). Descrições
-- inequivocamente corporativas (Sócios, Escritório Central, Ambev contrato
-- anual cross-bar, Variação de Estoque, Marketing) — DRE da holding,
-- não dados operacionais por-bar. Backfill arbitrário inflaria DRE de
-- algum bar com despesas que não são dele. (ε) honra a realidade: legacy
-- holding-level visível, novos registros forçam bar_id.
--
-- ESCOPO
-- Tabela: financial.dre_manual
-- Policy alvo: dre_manual_policy
-- Pre-flight: confirmado em sub-gate 1.5 que único INSERT em todo o repo
-- vem de frontend/src/app/api/financeiro/dre-simples/route.ts.
-- Backend (edge functions, scripts ETL, SQL functions) zero callers.
--
-- DEFESA EM PROFUNDIDADE
-- 1. ALTER POLICY com USING + WITH CHECK separados:
--    - SELECT/UPDATE/DELETE: USING (bar_id IS NULL OR has_access(bar_id))
--      preserva visibilidade das 82 legacy + filtra novas por multi-tenancy
--    - INSERT/UPDATE-new: WITH CHECK (bar_id IS NOT NULL AND has_access(bar_id))
--      bloqueia novos registros NULL via RLS
-- 2. CHECK constraint com cutoff temporal: bypassa para legacy
--    (criado_em < 2025-09-08), exige bar_id NOT NULL para registros novos
--    independentemente de role (cobre service_role que bypassa RLS).
-- 3. (Em outros arquivos do PR) Code fix em dre-simples/route.ts retorna
--    400 quando bar_id ausente; UI do DreManualModal disable button +
--    mensagem.
--
-- TRADEOFF DOCUMENTADO
-- Authenticated sem nenhum acesso a bar (ex: UUID inexistente em
-- usuarios_bares) ainda VÊ as 82 legacy via OR no USING. Decisão consciente
-- — descrições são corporativas, não secret. Compatível com pattern já
-- usado em /api/financeiro/dre-simples?bar_id=N que faz
-- bar_id.eq.${barId},bar_id.is.null em todos os SELECT.
--
-- Refs: task #43, sub-gate 1.5 (sec/03), precedente PR #15 (sec/02).

-- ============================================
-- Layer 1: ALTER POLICY com USING e WITH CHECK separados
-- ============================================
ALTER POLICY "dre_manual_policy" ON "financial"."dre_manual"
  USING (bar_id IS NULL OR public.user_has_bar_access(bar_id))
  WITH CHECK (bar_id IS NOT NULL AND public.user_has_bar_access(bar_id));

-- ============================================
-- Layer 2: CHECK constraint defensivo (com cutoff)
-- Cutoff = 2025-09-08 (dia seguinte ao import CSV de 2025-09-07 14:47:29).
-- Legacy (criado_em < cutoff) passa por causa do branch curto-circuito.
-- Registros novos exigem bar_id NOT NULL — barrera em nível de banco
-- que cobre service_role (bypass RLS).
-- ============================================
ALTER TABLE financial.dre_manual
  ADD CONSTRAINT dre_manual_bar_id_required_after_cutoff
  CHECK (criado_em < '2025-09-08'::timestamptz OR bar_id IS NOT NULL);
