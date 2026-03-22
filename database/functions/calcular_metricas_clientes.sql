CREATE OR REPLACE FUNCTION public.calcular_metricas_clientes(p_bar_id integer, p_data_inicio_atual date, p_data_fim_atual date, p_data_inicio_anterior date, p_data_fim_anterior date)
 RETURNS TABLE(total_atual bigint, novos_atual bigint, retornantes_atual bigint, total_anterior bigint, novos_anterior bigint, retornantes_anterior bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH clientes_atual AS (
    SELECT DISTINCT cliente_fone
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita >= p_data_inicio_atual
      AND data_visita <= p_data_fim_atual
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
  ),
  clientes_anterior AS (
    SELECT DISTINCT cliente_fone
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita >= p_data_inicio_anterior
      AND data_visita <= p_data_fim_anterior
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
  ),
  clientes_historico AS (
    SELECT DISTINCT cliente_fone
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita < p_data_inicio_atual
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
  ),
  clientes_historico_anterior AS (
    SELECT DISTINCT cliente_fone
    FROM public.visitas
    WHERE bar_id = p_bar_id
      AND data_visita < p_data_inicio_anterior
      AND cliente_fone IS NOT NULL
      AND LENGTH(cliente_fone) >= 8
  )
  SELECT
    (SELECT COUNT(*) FROM clientes_atual)::BIGINT AS total_atual,
    (SELECT COUNT(*) FROM clientes_atual WHERE cliente_fone NOT IN (SELECT cliente_fone FROM clientes_historico))::BIGINT AS novos_atual,
    (SELECT COUNT(*) FROM clientes_atual WHERE cliente_fone IN (SELECT cliente_fone FROM clientes_historico))::BIGINT AS retornantes_atual,
    (SELECT COUNT(*) FROM clientes_anterior)::BIGINT AS total_anterior,
    (SELECT COUNT(*) FROM clientes_anterior WHERE cliente_fone NOT IN (SELECT cliente_fone FROM clientes_historico_anterior))::BIGINT AS novos_anterior,
    (SELECT COUNT(*) FROM clientes_anterior WHERE cliente_fone IN (SELECT cliente_fone FROM clientes_historico_anterior))::BIGINT AS retornantes_anterior;
END;
$function$;
