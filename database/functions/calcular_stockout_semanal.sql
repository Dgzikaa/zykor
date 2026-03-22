-- Function: calcular_stockout_semanal
-- Exportado de produção em: 2026-03-19
-- Descrição: Calcula stockout semanal por categoria (Bar, Comidas, Drinks)
-- Usado por: recalcular-desempenho-auto

CREATE OR REPLACE FUNCTION public.calcular_stockout_semanal(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(categoria text, total_produtos bigint, produtos_stockout bigint, percentual_stockout numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    csf.categoria_local AS categoria,
    COUNT(*)::BIGINT AS total_produtos,
    COUNT(*) FILTER (WHERE csf.prd_venda = 'N')::BIGINT AS produtos_stockout,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE csf.prd_venda = 'N')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS percentual_stockout
  FROM contahub_stockout_filtrado csf
  WHERE csf.bar_id = p_bar_id
    AND csf.data_consulta >= p_data_inicio
    AND csf.data_consulta <= p_data_fim
    AND csf.categoria_local IS NOT NULL
  GROUP BY csf.categoria_local
  ORDER BY csf.categoria_local;
END;
$function$;
