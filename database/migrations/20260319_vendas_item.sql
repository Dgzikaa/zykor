-- ============================================================
-- MIGRATION: vendas_item + adapter_contahub_to_vendas_item
-- Data: 2026-03-19
-- Bloco: VENDAS_ITEM FASE 1-4
-- ============================================================

-- ============================================================
-- 1. TABELA vendas_item
-- ============================================================
-- Tabela de dominio unificada para itens de venda
-- Agnostica de origem (ContaHub, iFood, etc)

CREATE TABLE IF NOT EXISTS vendas_item (
  id BIGSERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL REFERENCES bares(id),
  data_venda DATE NOT NULL,
  produto_codigo TEXT,
  produto_desc TEXT,
  grupo_desc TEXT,
  local_desc TEXT,
  categoria_mix VARCHAR(10),
  quantidade NUMERIC(10,3) DEFAULT 0,
  valor NUMERIC(12,2) DEFAULT 0,
  desconto NUMERIC(12,2) DEFAULT 0,
  custo NUMERIC(12,2) DEFAULT 0,
  tipo_venda VARCHAR(30),
  tipo_transacao VARCHAR(30),
  origem VARCHAR(20) NOT NULL DEFAULT 'contahub',
  origem_ref INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vendas_item IS 'Tabela de dominio unificada para itens de venda, agnostica de origem (ContaHub, iFood, etc)';
COMMENT ON COLUMN vendas_item.bar_id IS 'ID do bar';
COMMENT ON COLUMN vendas_item.data_venda IS 'Data gerencial da venda';
COMMENT ON COLUMN vendas_item.produto_codigo IS 'Codigo do produto na origem';
COMMENT ON COLUMN vendas_item.produto_desc IS 'Descricao do produto';
COMMENT ON COLUMN vendas_item.grupo_desc IS 'Grupo/categoria do produto';
COMMENT ON COLUMN vendas_item.local_desc IS 'Local de venda (bar, cozinha, etc)';
COMMENT ON COLUMN vendas_item.categoria_mix IS 'Categoria para calculo de mix (bebidas, comidas, drinks)';
COMMENT ON COLUMN vendas_item.quantidade IS 'Quantidade vendida';
COMMENT ON COLUMN vendas_item.valor IS 'Valor final da venda';
COMMENT ON COLUMN vendas_item.desconto IS 'Desconto aplicado';
COMMENT ON COLUMN vendas_item.custo IS 'Custo do item';
COMMENT ON COLUMN vendas_item.tipo_venda IS 'Tipo/canal de venda (balcao, mesa, delivery, etc)';
COMMENT ON COLUMN vendas_item.tipo_transacao IS 'Tipo de transacao (venda integral, com desconto, 100% desconto, Insumo)';
COMMENT ON COLUMN vendas_item.origem IS 'Sistema de origem (contahub, ifood, etc)';
COMMENT ON COLUMN vendas_item.origem_ref IS 'ID do registro na tabela de origem';

-- ============================================================
-- 2. INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vendas_item_bar_data ON vendas_item(bar_id, data_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_item_mix ON vendas_item(bar_id, data_venda, categoria_mix);
CREATE INDEX IF NOT EXISTS idx_vendas_item_dedup ON vendas_item(bar_id, data_venda, origem, origem_ref);
CREATE INDEX IF NOT EXISTS idx_vendas_item_produto ON vendas_item(bar_id, produto_codigo);

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
