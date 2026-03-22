CREATE OR REPLACE FUNCTION adapter_contahub_to_faturamento_pagamentos(p_bar_id INTEGER, p_data DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_inserted INTEGER;
BEGIN
  DELETE FROM faturamento_pagamentos WHERE bar_id = p_bar_id AND data_pagamento = p_data AND origem = 'contahub';
  
  INSERT INTO faturamento_pagamentos (
    bar_id, data_pagamento, meio, tipo, valor_bruto, taxa, valor_liquido,
    cliente_nome, mesa_desc, origem, origem_ref
  )
  SELECT
    bar_id, dt_gerencial, meio, tipo, COALESCE(valor, 0), COALESCE(taxa, 0),
    COALESCE(liquido, 0), cliente, mesa, 'contahub', id
  FROM contahub_pagamentos
  WHERE bar_id = p_bar_id AND dt_gerencial = p_data;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;
