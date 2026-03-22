-- Função: get_insights_extras
CREATE OR REPLACE FUNCTION public.get_insights_extras(p_bar_id integer DEFAULT 3) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_result JSON;
BEGIN
  SELECT json_build_object(
    'vendedores', json_build_object('topVendedores', json_build_array(json_build_object('nome', 'Sistema', 'vendas', 0, 'observacao', 'Dados de vendedores em implementação'))),
    'clientesDormentes', json_build_object('total', 0, 'observacao', 'Análise de clientes dormentes disponível em breve'),
    'satisfacaoCliente', json_build_object('nps', COALESCE((SELECT AVG(nota) FROM nps WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data) = 2025), 0), 'googleRating', COALESCE((SELECT AVG(stars) FROM google_reviews WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM published_at_date) = 2025), 0))
  ) INTO v_result;
  RETURN v_result;
END;
$$;
