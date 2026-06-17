-- ============================================================================
-- Custo de produto via planilha de Engenharia de Cardapio / CMV (ficha tecnica)
-- ----------------------------------------------------------------------------
-- Problema: o /ferramentas/analises/cardapio calcula margem a partir de
-- silver.vendas_item.custo, que vem do ContaHub. O ContaHub so tem custo de
-- itens de revenda simples; drinks, pratos e combos chegam com custo 0/null
-- (45% dos itens no Ordinario, 59% no Deboche). A planilha de Engenharia de
-- Cardapio tem o CUSTO FINAL (ficha tecnica) por produto e e a fonte da verdade.
--
-- Esta tabela guarda o custo unitario da planilha, com chave de join igual a
-- de silver.vendas_item (bar_id, produto_codigo do ContaHub). Consumida por
-- gold.menu_engineering com prioridade sobre o custo do ContaHub.
--
-- Carga: scripts/parse_cardapio_planilha.py -> gen_load_custo_manual.py
-- (de-para por nome normalizado: match exato + prefixo, com remocao de
--  prefixos [PP]/[DD]/[HH]/[PPHH] e acentos).
-- ============================================================================

CREATE TABLE IF NOT EXISTS operations.produto_custo_manual (
  bar_id               integer       NOT NULL,
  produto_codigo       text          NOT NULL,   -- codigo ContaHub (join com silver.vendas_item)
  produto_desc         text,
  custo_manual         numeric(12,4) NOT NULL,    -- CUSTO FINAL unitario da planilha
  preco_venda_planilha numeric(12,2),             -- referencia (coluna K da planilha)
  codigo_planilha      text,                       -- b0001/c0003/d0009 (proveniencia)
  match_tipo           text,                       -- 'exato' | 'prefixo' | 'manual'
  fonte                text          NOT NULL DEFAULT 'planilha_cardapio',
  atualizado_em        timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (bar_id, produto_codigo)
);

COMMENT ON TABLE operations.produto_custo_manual IS
  'Custo unitario de produto da planilha de Engenharia de Cardapio/CMV. Join por (bar_id, produto_codigo) do ContaHub. Consumida por gold.menu_engineering com prioridade sobre o custo do ContaHub (regra: planilha sempre que existir).';

GRANT SELECT ON operations.produto_custo_manual TO authenticated, anon, service_role;
