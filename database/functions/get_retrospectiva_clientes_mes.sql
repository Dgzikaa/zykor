-- Função: get_retrospectiva_clientes_mes
CREATE OR REPLACE FUNCTION public.get_retrospectiva_clientes_mes(p_bar_id integer DEFAULT 3) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_agg(json_build_object('mes', mes, 'clientes', clientes) ORDER BY mes) INTO v_result
  FROM (SELECT EXTRACT(MONTH FROM ds.data_inicio) as mes, SUM(ds.clientes_atendidos) as clientes FROM desempenho_semanal ds WHERE ds.bar_id = p_bar_id AND EXTRACT(YEAR FROM ds.data_inicio) = 2025 GROUP BY EXTRACT(MONTH FROM ds.data_inicio)) sub;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
