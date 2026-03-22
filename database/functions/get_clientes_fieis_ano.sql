CREATE OR REPLACE FUNCTION public.get_clientes_fieis_ano(p_bar_id integer DEFAULT 3, p_ano integer DEFAULT 2025, p_limit integer DEFAULT 10)
 RETURNS TABLE(nome text, visitas bigint, totalgasto numeric, horasmedia numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY 
  SELECT 
    v.cliente_nome::TEXT,
    COUNT(DISTINCT v.data_visita)::BIGINT,
    SUM(v.valor_consumo)::NUMERIC,
    COALESCE(brn.horas_media_visita, 2.5)::NUMERIC
  FROM visitas v
  LEFT JOIN bar_regras_negocio brn ON brn.bar_id = v.bar_id
  WHERE v.bar_id = p_bar_id 
    AND EXTRACT(YEAR FROM v.data_visita) = p_ano 
    AND v.cliente_nome IS NOT NULL 
    AND v.cliente_nome != ''
  GROUP BY v.cliente_nome, brn.horas_media_visita
  ORDER BY COUNT(DISTINCT v.data_visita) DESC 
  LIMIT p_limit;
END;
$function$;