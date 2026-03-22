-- ============================================================
-- FUNCTION: get_insights_adicionais
-- Descricao: Retorna insights agregados (reviews, reservas, categorias)
-- Fonte categoriasDetalhadas: vendas_item (migrado 2026-03-20)
-- Fonte googleReviews: google_reviews (nao alterado)
-- Fonte reservas: eventos (nao alterado)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_insights_adicionais(
  p_bar_id integer DEFAULT 3
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'googleReviews', json_build_object(
      'mediaAvaliacoes', COALESCE((
        SELECT AVG(stars)
        FROM google_reviews
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM published_at_date) = 2025
      ), 0),
      'totalAvaliacoes', COALESCE((
        SELECT COUNT(*)
        FROM google_reviews
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM published_at_date) = 2025
      ), 0)
    ),
    'reservas', json_build_object(
      'totalReservas', COALESCE((
        SELECT SUM(res_tot)
        FROM eventos
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025
      ), 0),
      'pessoasReservas', COALESCE((
        SELECT SUM(res_p)
        FROM eventos
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025
      ), 0),
      'taxaComparecimento', COALESCE((
        SELECT CASE WHEN SUM(res_tot) > 0 
          THEN (SUM(res_p)::float / SUM(res_tot)::float * 100)
          ELSE 0 END
        FROM eventos
        WHERE bar_id = p_bar_id AND EXTRACT(YEAR FROM data_evento) = 2025
      ), 0)
    ),
    'categoriasDetalhadas', (
      SELECT json_agg(
        json_build_object(
          'categoria', categoria,
          'faturamento', total_faturamento,
          'quantidade', total_quantidade,
          'ticketMedio', CASE WHEN total_quantidade > 0 THEN total_faturamento / total_quantidade ELSE 0 END
        )
      )
      FROM (
        SELECT 
          vi.grupo_desc as categoria,
          SUM(vi.valor) as total_faturamento,
          SUM(vi.quantidade) as total_quantidade
        FROM vendas_item vi
        WHERE vi.bar_id = p_bar_id 
          AND EXTRACT(YEAR FROM vi.data_venda) = 2025
          AND vi.grupo_desc IS NOT NULL
          AND vi.grupo_desc != ''
        GROUP BY vi.grupo_desc
        ORDER BY SUM(vi.valor) DESC
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION get_insights_adicionais(INTEGER) 
  IS 'Insights adicionais - categoriasDetalhadas le de vendas_item (migrado 2026-03-20)';
