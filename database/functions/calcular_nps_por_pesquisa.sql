-- Função: calcular_nps_por_pesquisa
CREATE OR REPLACE FUNCTION public.calcular_nps_por_pesquisa(p_bar_id integer, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(search_name text, total_respostas integer, promotores integer, neutros integer, detratores integer, nps_score numeric) LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(search_name, 'Sem Pesquisa'), COUNT(*)::INTEGER, COUNT(*) FILTER (WHERE nps >= 9)::INTEGER, COUNT(*) FILTER (WHERE nps >= 7 AND nps <= 8)::INTEGER, COUNT(*) FILTER (WHERE nps <= 6)::INTEGER,
    CASE WHEN COUNT(*) > 0 THEN ROUND(((COUNT(*) FILTER (WHERE nps >= 9)::NUMERIC / COUNT(*) * 100) - (COUNT(*) FILTER (WHERE nps <= 6)::NUMERIC / COUNT(*) * 100)), 1) ELSE 0 END
  FROM falae_respostas WHERE bar_id = p_bar_id AND created_at::date >= p_data_inicio AND created_at::date <= p_data_fim GROUP BY search_name;
$$;
