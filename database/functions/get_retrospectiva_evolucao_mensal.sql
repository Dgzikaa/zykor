-- Função: get_retrospectiva_evolucao_mensal
CREATE OR REPLACE FUNCTION public.get_retrospectiva_evolucao_mensal(p_bar_id integer DEFAULT 3) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_agg(json_build_object('mes', mes, 'faturamento', faturamento, 'clientes', clientes, 'ticketMedio', ticket_medio) ORDER BY mes) INTO v_result
  FROM (SELECT EXTRACT(MONTH FROM ds.data_inicio) as mes, SUM(ds.faturamento_total) as faturamento, SUM(ds.clientes_atendidos) as clientes, AVG(ds.ticket_medio) as ticket_medio FROM desempenho_semanal ds WHERE ds.bar_id = p_bar_id AND EXTRACT(YEAR FROM ds.data_inicio) = 2025 GROUP BY EXTRACT(MONTH FROM ds.data_inicio)) sub;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
