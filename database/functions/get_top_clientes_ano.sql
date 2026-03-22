CREATE OR REPLACE FUNCTION public.get_top_clientes_ano(p_bar_id integer DEFAULT 3, p_ano integer DEFAULT 2025, p_limit integer DEFAULT 10)
 RETURNS TABLE(nome text, totalgasto numeric, visitas bigint, ticketmedio numeric, horasmedia numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY 
  SELECT 
    v.cliente_nome::TEXT,
    SUM(v.valor_consumo)::NUMERIC,
    COUNT(DISTINCT v.data_visita)::BIGINT,
    AVG(v.valor_consumo)::NUMERIC,
    2.5::NUMERIC
  FROM visitas v
  WHERE v.bar_id = p_bar_id 
    AND EXTRACT(YEAR FROM v.data_visita) = p_ano 
    AND v.cliente_nome IS NOT NULL 
    AND v.cliente_nome != ''
  GROUP BY v.cliente_nome 
  ORDER BY SUM(v.valor_consumo) DESC 
  LIMIT p_limit;
END;
$function$;
