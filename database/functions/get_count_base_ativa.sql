CREATE OR REPLACE FUNCTION public.get_count_base_ativa(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(DISTINCT cliente_fone)
  INTO v_count
  FROM (
    SELECT cliente_fone, COUNT(*) as visitas
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita >= p_data_inicio
      AND data_visita <= p_data_fim
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
    GROUP BY cliente_fone
    HAVING COUNT(*) >= 2
  ) AS clientes_ativos;
  
  RETURN COALESCE(v_count, 0);
END;
$function$;
