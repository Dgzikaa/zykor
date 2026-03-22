CREATE OR REPLACE FUNCTION public.calcular_mix_vendas(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(total_vendas numeric, perc_bebidas numeric, perc_drinks numeric, perc_comidas numeric, perc_happy_hour numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH dados AS (
    SELECT 
      valor::numeric as valor,
      categoria_mix,
      grupo_desc
    FROM vendas_item
    WHERE bar_id = p_bar_id
      AND data_venda >= p_data_inicio
      AND data_venda <= p_data_fim
      AND tipo_transacao IN ('venda integral', 'com desconto', '100% desconto')
      AND categoria_mix IS NOT NULL
  )
  SELECT 
    SUM(valor) as total_vendas,
    CASE WHEN SUM(valor) > 0 THEN 
      ROUND(SUM(CASE WHEN categoria_mix = 'BEBIDA' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) 
    ELSE 0 END as perc_bebidas,
    CASE WHEN SUM(valor) > 0 THEN 
      ROUND(SUM(CASE WHEN categoria_mix = 'DRINK' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) 
    ELSE 0 END as perc_drinks,
    CASE WHEN SUM(valor) > 0 THEN 
      ROUND(SUM(CASE WHEN categoria_mix = 'COMIDA' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) 
    ELSE 0 END as perc_comidas,
    CASE WHEN SUM(valor) > 0 THEN 
      ROUND(SUM(CASE WHEN grupo_desc = 'Happy Hour' THEN valor ELSE 0 END) / SUM(valor) * 100, 2) 
    ELSE 0 END as perc_happy_hour
  FROM dados;
END;
$function$;
