CREATE OR REPLACE FUNCTION adapter_contahub_to_faturamento_hora(p_bar_id INTEGER, p_data DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_inserted INTEGER;
BEGIN
  DELETE FROM faturamento_hora WHERE bar_id = p_bar_id AND data_venda = p_data AND origem = 'contahub';
  
  INSERT INTO faturamento_hora (bar_id, data_venda, hora, quantidade, valor, origem, origem_ref)
  SELECT bar_id, vd_dtgerencial, hora, COALESCE(qtd, 0), COALESCE(valor, 0), 'contahub', id
  FROM contahub_fatporhora
  WHERE bar_id = p_bar_id AND vd_dtgerencial = p_data;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;
