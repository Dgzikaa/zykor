-- 2026-06-14 — Segurança: fechar leitura ANÔNIMA de tabelas financeiras/custos.
-- Havia policies `anon_select` com USING(true) e roles {anon,authenticated}, ou seja,
-- qualquer um com a anon key (pública no bundle do front) lia a tabela inteira SEM login.
-- Todas essas tabelas são lidas apenas por API routes server-side (service role, que
-- bypassa RLS), então remover o anon NÃO quebra o app — só fecha a exposição.
-- Mantém `authenticated` (consistente com as demais tabelas do app).
-- Aplicado em prod via MCP nesta data.

ALTER POLICY anon_select ON bronze.bronze_stone_conciliacao   TO authenticated;  -- conciliação cartão Stone
ALTER POLICY anon_select ON financial.dre_categoria_macro       TO authenticated; -- config DRE
ALTER POLICY anon_select ON financial.fluxo_caixa_previsto      TO authenticated; -- fluxo de caixa previsto
ALTER POLICY anon_select ON operations.produto_custo_manual     TO authenticated; -- custo manual de produtos
ALTER POLICY anon_select ON operations.produto_custo_historico  TO authenticated; -- histórico de custo

-- Obs: integrations.instagram_data_deletion_requests ficou com anon de propósito
-- (fluxo de exclusão de dados do Meta pode exigir leitura pública do status) — revisar à parte.
