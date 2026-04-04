-- ============================================
-- Process Cancelamentos Data
-- ============================================
-- Processa cancelamentos do ContaHub e insere como pagamentos NEGATIVOS
-- em contahub_pagamentos para serem incluídos no faturamento
-- ============================================

CREATE OR REPLACE FUNCTION public.process_cancelamentos_data(
  p_bar_id INTEGER,
  p_data_array JSONB,
  p_data_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  item_json JSONB;
  inserted_count INTEGER := 0;
  v_liquido NUMERIC;
  v_meio TEXT;
  v_mesa TEXT;
BEGIN
  -- Processar cada cancelamento
  FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
    -- Extrair valores
    v_liquido := COALESCE((item_json->>'itm_vrunitario')::NUMERIC, (item_json->>'itm_vrcheio')::NUMERIC, 0);
    v_mesa := COALESCE(item_json->>'vd_mesadesc', '');
    
    -- Determinar meio de pagamento
    -- Se mesa começa com 'X' ou tem motivo específico, é Conta Assinada
    v_meio := CASE
      WHEN v_mesa LIKE 'X %' THEN 'Conta Assinada'
      WHEN item_json->>'motivocancdesconto' ILIKE '%banda%' THEN 'Conta Assinada'
      WHEN item_json->>'motivocancdesconto' ILIKE '%funcionario%' THEN 'Conta Assinada'
      WHEN item_json->>'motivocancdesconto' ILIKE '%funcionário%' THEN 'Conta Assinada'
      WHEN item_json->>'motivocancdesconto' ILIKE '%consumação%' THEN 'Conta Assinada'
      WHEN item_json->>'motivocancdesconto' ILIKE '%consumacao%' THEN 'Conta Assinada'
      ELSE 'Dinheiro' -- Default para cancelamentos sem meio específico
    END;

    -- Inserir como pagamento NEGATIVO em contahub_pagamentos
    INSERT INTO contahub_pagamentos (
      bar_id,
      dt_gerencial,
      vd,
      trn,
      mesa,
      cliente,
      valor,
      liquido,
      meio,
      tipo,
      usr_lancou,
      motivodesconto
    ) VALUES (
      p_bar_id,
      COALESCE((item_json->>'dt_gerencial')::DATE, p_data_date),
      COALESCE(item_json->>'vd', ''),
      COALESCE(item_json->>'trn', ''),
      v_mesa,
      COALESCE(item_json->>'cancelou', ''), -- Quem cancelou
      -v_liquido, -- NEGATIVO para representar cancelamento
      -v_liquido, -- NEGATIVO
      v_meio,
      'Cancelamento',
      COALESCE(item_json->>'cancelou', ''),
      COALESCE(item_json->>'motivocancdesconto', '')
    );
    
    inserted_count := inserted_count + 1;
  END LOOP;

  RAISE NOTICE 'Processados % cancelamentos como pagamentos negativos', inserted_count;
  
  -- Atualizar faturamento_pagamentos com os cancelamentos incluídos
  PERFORM adapter_contahub_to_faturamento_pagamentos(p_bar_id, p_data_date);
  
  RETURN inserted_count;
END;
$function$;

COMMENT ON FUNCTION public.process_cancelamentos_data IS 
'Processa cancelamentos do ContaHub e insere como pagamentos NEGATIVOS em contahub_pagamentos. Deve ser chamado APÓS process_pagamentos_data.';
