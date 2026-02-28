-- =====================================================
-- FUNÇÃO: update_eventos_base_from_contahub_batch
-- =====================================================
-- Atualiza eventos_base com dados do ContaHub (batch)
-- CORREÇÃO: Não deve tocar em yuzer_liquido/yuzer_ingressos
-- Esses campos são exclusivos para dados Yuzer/Sympla
-- =====================================================

CREATE OR REPLACE FUNCTION update_eventos_base_from_contahub_batch(
  p_bar_id INTEGER,
  p_data_evento DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_publico INTEGER;
  v_percent_stockout NUMERIC;
  v_evento_id INTEGER;
  v_result TEXT;
BEGIN
  -- Calcular total de pessoas do dia (contahub_periodo)
  SELECT SUM(pessoas)::INTEGER
  INTO v_publico
  FROM contahub_periodo
  WHERE bar_id = p_bar_id
    AND dt_gerencial::date = p_data_evento;
  
  -- Calcular % stockout EXCLUINDO [HH], [DD] e [IN]
  SELECT 
    ROUND(
      (SUM(CASE WHEN prd_venda = 'N' THEN 1 ELSE 0 END)::numeric / 
       NULLIF(COUNT(*)::numeric, 0) * 100), 
      2
    )
  INTO v_percent_stockout
  FROM contahub_stockout
  WHERE bar_id = p_bar_id
    AND data_consulta = p_data_evento
    AND prd_desc NOT LIKE '[HH]%'  -- Excluir Happy Hour
    AND prd_desc NOT LIKE '[DD]%'  -- Excluir Dose Dupla
    AND prd_desc NOT LIKE '[IN]%'; -- Excluir Insumos
  
  -- Verificar se existe evento para essa data
  SELECT id INTO v_evento_id
  FROM eventos_base
  WHERE bar_id = p_bar_id
    AND data_evento = p_data_evento;
  
  -- Se existe evento, atualizar APENAS campos ContaHub
  IF v_evento_id IS NOT NULL THEN
    UPDATE eventos_base
    SET 
      publico_real = COALESCE(v_publico, publico_real),
      percent_stockout = COALESCE(v_percent_stockout, percent_stockout),
      atualizado_em = NOW()
    WHERE id = v_evento_id;
    
    v_result := format('Evento %s atualizado: publico=%s, stockout=%s%%', 
                       v_evento_id, v_publico, v_percent_stockout);
  ELSE
    v_result := format('Nenhum evento encontrado para %s no bar %s', p_data_evento, p_bar_id);
  END IF;
  
  RETURN v_result;
END;
$$;
