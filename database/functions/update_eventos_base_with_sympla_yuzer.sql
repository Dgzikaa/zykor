-- Função: update_eventos_base_with_sympla_yuzer
CREATE OR REPLACE FUNCTION public.update_eventos_base_with_sympla_yuzer(p_bar_id integer, p_data_inicio date, p_data_fim date) RETURNS TABLE(total_atualizados integer, mensagem text) LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_eventos_yuzer INTEGER := 0; v_eventos_sympla INTEGER := 0;
BEGIN
  WITH yuzer_entrada AS (SELECT data_evento, SUM(CASE WHEN produto_nome ILIKE '%ingresso%' OR produto_nome ILIKE '%entrada%' OR produto_nome ILIKE '%couvert%' OR eh_ingresso = true THEN valor_total ELSE 0 END) as entrada_bruto, SUM(CASE WHEN produto_nome ILIKE '%ingresso%' OR produto_nome ILIKE '%entrada%' OR produto_nome ILIKE '%couvert%' OR eh_ingresso = true THEN quantidade ELSE 0 END) as qtd_ingressos FROM yuzer_produtos WHERE bar_id = p_bar_id AND data_evento >= p_data_inicio AND data_evento <= p_data_fim GROUP BY data_evento),
  yuzer_pagamento_data AS (SELECT data_evento, faturamento_bruto FROM yuzer_pagamento WHERE bar_id = p_bar_id AND data_evento >= p_data_inicio AND data_evento <= p_data_fim)
  UPDATE eventos_base eb SET faturamento_entrada_yuzer = ROUND(COALESCE(ye.entrada_bruto, 0) * 0.972, 2)::numeric(10,2), faturamento_bar_yuzer = ROUND((COALESCE(yp.faturamento_bruto, 0) - COALESCE(ye.entrada_bruto, 0)) * 0.972, 2)::numeric(10,2), yuzer_liquido = ROUND(COALESCE(yp.faturamento_bruto, 0) * 0.972, 2)::numeric(10,2), yuzer_ingressos = COALESCE(ye.qtd_ingressos, 0)
  FROM yuzer_entrada ye FULL OUTER JOIN yuzer_pagamento_data yp ON ye.data_evento = yp.data_evento WHERE eb.data_evento = COALESCE(ye.data_evento, yp.data_evento) AND eb.bar_id = p_bar_id AND eb.ativo = true;
  GET DIAGNOSTICS v_eventos_yuzer = ROW_COUNT;
  WITH sympla_agregado AS (SELECT se.data_inicio::date as data_evento, MAX(sr.receita_total) as sympla_liquido, COUNT(CASE WHEN sp.fez_checkin = true THEN 1 END) as sympla_checkins FROM sympla_eventos se LEFT JOIN sympla_resumo sr ON se.evento_sympla_id = sr.evento_sympla_id LEFT JOIN sympla_participantes sp ON se.evento_sympla_id = sp.evento_sympla_id WHERE se.bar_id = p_bar_id AND se.data_inicio::date >= p_data_inicio AND se.data_inicio::date <= p_data_fim GROUP BY se.data_inicio::date)
  UPDATE eventos_base eb SET sympla_liquido = COALESCE(sa.sympla_liquido, 0)::numeric(10,2), sympla_checkins = COALESCE(sa.sympla_checkins, 0) FROM sympla_agregado sa WHERE eb.data_evento = sa.data_evento AND eb.bar_id = p_bar_id AND eb.ativo = true;
  GET DIAGNOSTICS v_eventos_sympla = ROW_COUNT;
  RETURN QUERY SELECT v_eventos_yuzer + v_eventos_sympla, format('Yuzer: %s | Sympla: %s', v_eventos_yuzer, v_eventos_sympla)::TEXT;
END;
$$;
