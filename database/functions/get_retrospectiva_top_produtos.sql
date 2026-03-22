-- ============================================================
-- FUNCTION: get_retrospectiva_top_produtos
-- Descricao: Retorna top produtos por quantidade vendida
-- Fonte: vendas_item (migrado 2026-03-20)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_retrospectiva_top_produtos(
  p_bar_id integer DEFAULT 3,
  p_limit integer DEFAULT 15
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'produto', produto,
      'quantidade', quantidade,
      'faturamento', faturamento
    )
  ) INTO v_result
  FROM (
    SELECT 
      vi.produto_desc as produto,
      SUM(vi.quantidade) as quantidade,
      SUM(vi.valor) as faturamento
    FROM vendas_item vi
    WHERE vi.bar_id = p_bar_id
      AND EXTRACT(YEAR FROM vi.data_venda) = 2025
      AND vi.produto_desc IS NOT NULL
    GROUP BY vi.produto_desc
    ORDER BY SUM(vi.quantidade) DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

COMMENT ON FUNCTION get_retrospectiva_top_produtos(INTEGER, INTEGER) 
  IS 'Top produtos - le de vendas_item (migrado 2026-03-20)';
