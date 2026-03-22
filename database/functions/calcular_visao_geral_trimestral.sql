-- Função: calcular_visao_geral_trimestral
CREATE OR REPLACE FUNCTION public.calcular_visao_geral_trimestral(p_bar_id integer, p_trimestre integer, p_ano integer)
 RETURNS TABLE(clientes_totais numeric, clientes_ativos numeric, variacao_clientes_totais numeric, variacao_clientes_ativos numeric, cmo_total numeric, cmo_percentual numeric, variacao_cmo numeric, faturamento_trimestre numeric, artistica_percentual numeric, variacao_artistica numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_trimestre_anterior INT; v_ano_anterior INT;
BEGIN
  IF p_trimestre = 1 THEN v_trimestre_anterior := 4; v_ano_anterior := p_ano - 1; ELSE v_trimestre_anterior := p_trimestre - 1; v_ano_anterior := p_ano; END IF;
  RETURN QUERY
  WITH atual AS (SELECT v.clientes_totais, v.base_ativa_90d, v.cmo_total, v.cmo_percent, v.faturamento_trimestre, v.artistica_percent FROM public.view_visao_geral_trimestral v WHERE v.bar_id = p_bar_id AND v.ano = p_ano AND v.trimestre = p_trimestre),
  anterior AS (SELECT v.clientes_totais, v.base_ativa_90d, v.cmo_total, v.cmo_percent, v.faturamento_trimestre, v.artistica_percent FROM public.view_visao_geral_trimestral v WHERE v.bar_id = p_bar_id AND v.ano = v_ano_anterior AND v.trimestre = v_trimestre_anterior)
  SELECT COALESCE(atual.clientes_totais, 0), COALESCE(atual.base_ativa_90d, 0), 0::NUMERIC, 0::NUMERIC, COALESCE(atual.cmo_total, 0), COALESCE(atual.cmo_percent, 0), 0::NUMERIC, COALESCE(atual.faturamento_trimestre, 0), COALESCE(atual.artistica_percent, 0), 0::NUMERIC FROM atual LEFT JOIN anterior ON true;
END;
$$;
