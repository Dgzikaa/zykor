CREATE OR REPLACE FUNCTION public.adapter_contahub_to_visitas(p_bar_id integer, p_data date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO visitas (
    bar_id,
    data_visita,
    cliente_nome,
    cliente_fone,
    cliente_email,
    pessoas,
    valor_pagamentos,
    valor_consumo,
    valor_produtos,
    valor_couvert,
    valor_desconto,
    valor_repique,
    mesa_desc,
    motivo_desconto,
    origem,
    origem_ref,
    updated_at
  )
  SELECT
    cp.bar_id,
    cp.dt_gerencial,
    cp.cli_nome,
    cp.cli_fone,
    cp.cli_email,
    COALESCE(cp.pessoas, 1),
    COALESCE(cp.vr_pagamentos, 0),
    COALESCE(cp.vr_pagamentos, 0) - COALESCE(cp.vr_couvert, 0),  -- valor_consumo = gasto no bar
    COALESCE(cp.vr_produtos, 0),
    COALESCE(cp.vr_couvert, 0),
    COALESCE(cp.vr_desconto, 0),
    COALESCE(cp.vr_repique, 0),
    cp.vd_mesadesc,
    cp.motivo,
    'contahub'::VARCHAR(30),
    cp.id,
    NOW()
  FROM contahub_periodo cp
  WHERE cp.bar_id = p_bar_id
    AND cp.dt_gerencial = p_data
  ON CONFLICT (bar_id, origem, origem_ref)
  DO UPDATE SET
    cliente_nome = EXCLUDED.cliente_nome,
    cliente_fone = EXCLUDED.cliente_fone,
    cliente_email = EXCLUDED.cliente_email,
    pessoas = EXCLUDED.pessoas,
    valor_pagamentos = EXCLUDED.valor_pagamentos,
    valor_consumo = EXCLUDED.valor_consumo,
    valor_produtos = EXCLUDED.valor_produtos,
    valor_couvert = EXCLUDED.valor_couvert,
    valor_desconto = EXCLUDED.valor_desconto,
    valor_repique = EXCLUDED.valor_repique,
    mesa_desc = EXCLUDED.mesa_desc,
    motivo_desconto = EXCLUDED.motivo_desconto,
    updated_at = NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$function$;
