CREATE OR REPLACE FUNCTION adapter_contahub_to_tempos_producao(p_bar_id INTEGER, p_data DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_inserted INTEGER;
BEGIN
  DELETE FROM tempos_producao WHERE bar_id = p_bar_id AND data_producao = p_data AND origem = 'contahub';
  
  INSERT INTO tempos_producao (
    bar_id, data_producao, produto_codigo, produto_desc, grupo_desc,
    local_desc, categoria, t0_lancamento, t1_prodini, t2_prodfim, t3_entrega,
    t0_t1, t0_t2, t0_t3, t1_t2, t2_t3, quantidade, origem, origem_ref
  )
  SELECT
    bar_id, data, prd, prd_desc, grp_desc,
    loc_desc, categoria, t0_lancamento, t1_prodini, t2_prodfim, t3_entrega,
    COALESCE(t0_t1, 0), COALESCE(t0_t2, 0), COALESCE(t0_t3, 0),
    COALESCE(t1_t2, 0), COALESCE(t2_t3, 0), COALESCE(itm_qtd, 1),
    'contahub', id
  FROM contahub_tempo
  WHERE bar_id = p_bar_id AND data = p_data;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;
