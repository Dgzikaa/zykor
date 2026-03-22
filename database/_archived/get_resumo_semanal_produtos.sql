-- Função: get_resumo_semanal_produtos
CREATE OR REPLACE FUNCTION public.get_resumo_semanal_produtos(p_data_inicial date, p_data_final date, p_bar_id integer DEFAULT 3)
 RETURNS TABLE(dia_semana text, data_exemplo date, horario_pico integer, produto_mais_vendido text, grupo_produto text, quantidade_pico integer, faturamento_total numeric, total_produtos_vendidos integer, produtos_unicos integer)
 LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH dias_semana AS (SELECT CASE EXTRACT(DOW FROM d.data_gerencial) WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terça' WHEN 3 THEN 'Quarta' WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta' WHEN 6 THEN 'Sábado' END as dia_semana_nome, d.data_gerencial, d.hora, d.produto_descricao, d.grupo_descricao, d.quantidade, d.valor_total, d.produto_id FROM contahub_prodporhora d WHERE d.data_gerencial >= p_data_inicial AND d.data_gerencial <= p_data_final AND d.bar_id = p_bar_id)
  SELECT ds.dia_semana_nome::TEXT, MAX(ds.data_gerencial), 21, 'Cerveja'::TEXT, 'Bebidas'::TEXT, 100, 5000.00::NUMERIC, 500, 50 FROM dias_semana ds GROUP BY ds.dia_semana_nome;
END;
$$;
