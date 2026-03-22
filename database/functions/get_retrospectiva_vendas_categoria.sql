-- ============================================================
-- FUNCTION: get_retrospectiva_vendas_categoria
-- Descricao: Retorna vendas agregadas por categoria
-- Fonte: vendas_item (migrado 2026-03-20)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_retrospectiva_vendas_categoria(
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
  SELECT json_agg(
    json_build_object(
      'categoria', categoria,
      'quantidade_total', quantidade_total,
      'faturamento_total', faturamento_total
    )
  ) INTO v_result
  FROM (
    SELECT 
      vi.grupo_desc as categoria,
      SUM(vi.quantidade) as quantidade_total,
      SUM(vi.valor) as faturamento_total
    FROM vendas_item vi
    WHERE vi.bar_id = p_bar_id
      AND EXTRACT(YEAR FROM vi.data_venda) = 2025
      AND vi.grupo_desc IS NOT NULL
    GROUP BY vi.grupo_desc
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

COMMENT ON FUNCTION get_retrospectiva_vendas_categoria(INTEGER) 
  IS 'Vendas por categoria - le de vendas_item (migrado 2026-03-20)';
