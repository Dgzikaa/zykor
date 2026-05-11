-- ============================================================
-- 2026-05-11 — RPC canônica de stockout (fonte de verdade única)
-- ============================================================
-- Problema:
--   Stockout era calculado em 3 lugares com regras diferentes:
--     - /ferramentas/stockout (UI) — usa prd_venda='N', filtra
--       "Feijoada + Sobremesa" em não-sábados
--     - gold.planejamento — usa prd_venda='N', NÃO filtra Feijoada
--     - /analitico/eventos (stockout-resumo) — usava prd_ativo, sempre 0%
-- Solução:
--   Função pública `calcular_stockout_dia` que retorna stats por
--   categoria_mix, sempre filtrando Feijoada em não-sábados.
--   Será chamada por todas as APIs e (em migration futura) também
--   pelo ETL gold.planejamento.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.calcular_stockout_dia(
  p_bar_id integer,
  p_data   date
)
RETURNS TABLE (
  categoria         text,
  total             integer,
  stockout          integer,
  disponiveis       integer,
  pct_stockout      numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(categoria_mix, ''), 'OUTROS') AS categoria,
      prd_venda,
      prd_desc
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id
      AND data_consulta = p_data
      AND incluido = true
      -- Filtra Feijoada + Sobremesa quando não é sábado
      AND NOT (
        prd_desc = 'Feijoada + Sobremesa'
        AND EXTRACT(DOW FROM p_data) <> 6
      )
  ),
  por_categoria AS (
    SELECT
      categoria,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE prd_venda = 'N')::int AS stockout,
      COUNT(*) FILTER (WHERE prd_venda = 'S')::int AS disponiveis
    FROM base
    GROUP BY categoria
  )
  SELECT
    categoria,
    total,
    stockout,
    disponiveis,
    ROUND((stockout * 100.0 / NULLIF(total, 0))::numeric, 2) AS pct_stockout
  FROM por_categoria
  UNION ALL
  SELECT
    'TOTAL' AS categoria,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE prd_venda = 'N')::int AS stockout,
    COUNT(*) FILTER (WHERE prd_venda = 'S')::int AS disponiveis,
    ROUND((COUNT(*) FILTER (WHERE prd_venda = 'N') * 100.0 / NULLIF(COUNT(*), 0))::numeric, 2)
  FROM base
  ORDER BY 1;
$function$;

GRANT EXECUTE ON FUNCTION public.calcular_stockout_dia(integer, date)
  TO anon, authenticated, service_role;

COMMIT;

-- Validação
SELECT * FROM public.calcular_stockout_dia(3, '2026-05-10');
