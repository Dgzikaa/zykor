-- ============================================================
-- FUNCTION: adapter_contahub_to_vendas_item
-- Autor: Sistema
-- Data: 2026-03-19
-- Atualizado: 2026-03-19 - Adicionado tipo_transacao
-- Descricao: Adapter que copia dados de contahub_analitico 
--            para vendas_item de forma idempotente
-- ============================================================

CREATE OR REPLACE FUNCTION adapter_contahub_to_vendas_item(
  p_bar_id INTEGER,
  p_data DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
  v_inserted INTEGER;
BEGIN
  DELETE FROM vendas_item
  WHERE bar_id = p_bar_id
    AND data_venda = p_data
    AND origem = 'contahub';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  INSERT INTO vendas_item (
    bar_id,
    data_venda,
    produto_codigo,
    produto_desc,
    grupo_desc,
    local_desc,
    categoria_mix,
    quantidade,
    valor,
    desconto,
    custo,
    tipo_venda,
    tipo_transacao,
    origem,
    origem_ref
  )
  SELECT
    ca.bar_id,
    ca.trn_dtgerencial,
    ca.prd,
    ca.prd_desc,
    ca.grp_desc,
    ca.loc_desc,
    ca.categoria_mix,
    COALESCE(ca.qtd, 0),
    COALESCE(ca.valorfinal, 0),
    COALESCE(ca.desconto, 0),
    COALESCE(ca.custo, 0),
    ca.tipovenda,
    ca.tipo,
    'contahub',
    ca.id
  FROM contahub_analitico ca
  WHERE ca.bar_id = p_bar_id
    AND ca.trn_dtgerencial = p_data;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  RAISE NOTICE 'adapter_contahub_to_vendas_item: bar=%, data=%, deleted=%, inserted=%',
    p_bar_id, p_data, v_deleted, v_inserted;
  
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION adapter_contahub_to_vendas_item(INTEGER, DATE) 
  IS 'Adapter que copia dados de contahub_analitico para vendas_item de forma idempotente';
