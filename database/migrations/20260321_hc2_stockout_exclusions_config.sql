-- HC-2: Mover filtros de exclusao de stockout para config
-- Antes: hardcoded para bar_id=4 (Deboche)
-- Depois: config em bar_local_mapeamento.produtos_excluidos_stockout

-- PASSO 1: Adicionar coluna para produtos excluidos
ALTER TABLE bar_local_mapeamento 
ADD COLUMN IF NOT EXISTS produtos_excluidos_stockout TEXT[] DEFAULT '{}';

-- PASSO 2: Inserir/atualizar config para Deboche (bar_id=4)
INSERT INTO bar_local_mapeamento (bar_id, categoria, locais, ativo, produtos_excluidos_stockout)
VALUES (
  4, 
  'excluidos', 
  '{}', 
  true,
  ARRAY['dose dupla', 'dose dulpa', 'chegadeira', 'sem alcool', 'grupo adicional', 'promo chivas', 'uso interno']
)
ON CONFLICT (bar_id, categoria) 
DO UPDATE SET produtos_excluidos_stockout = EXCLUDED.produtos_excluidos_stockout;

-- PASSO 3: Inserir config para Ordinario (bar_id=3) sem exclusoes especificas
INSERT INTO bar_local_mapeamento (bar_id, categoria, locais, ativo, produtos_excluidos_stockout)
VALUES (3, 'excluidos', '{}', true, '{}')
ON CONFLICT (bar_id, categoria) DO NOTHING;
