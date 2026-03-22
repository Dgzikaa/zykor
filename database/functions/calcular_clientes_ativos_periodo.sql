CREATE OR REPLACE FUNCTION public.calcular_clientes_ativos_periodo(p_bar_id integer, p_data_inicio_periodo date, p_data_fim_periodo date, p_data_90_dias_atras date)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count BIGINT;
BEGIN
  WITH clientes_periodo AS (
    SELECT DISTINCT cliente_fone
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita >= p_data_inicio_periodo
      AND data_visita <= p_data_fim_periodo
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
  ),
  clientes_ativos_90d AS (
    SELECT cliente_fone
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita >= p_data_90_dias_atras
      AND data_visita <= p_data_fim_periodo
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
    GROUP BY cliente_fone
    HAVING COUNT(*) >= 2
  )
  SELECT COUNT(*)
  INTO v_count
  FROM clientes_periodo cp
  WHERE cp.cliente_fone IN (SELECT cliente_fone FROM clientes_ativos_90d);
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
