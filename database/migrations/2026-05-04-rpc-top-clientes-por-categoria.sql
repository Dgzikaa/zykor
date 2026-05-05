-- 2026-05-04: RPCs pra top clientes por categoria de produto
--
-- Suporte para nova tela /analitico/clientes -> aba "Top por Categoria":
--   1. listar_categorias_clientes_estatisticas: lista categorias disponiveis
--   2. top_clientes_por_categoria: ranking de clientes por categoria
--
-- Le silver.cliente_estatisticas.produtos_favoritos (jsonb top 10 por cliente,
-- ja populado pelo ETL diario silver-cliente-estatisticas-diario).

CREATE OR REPLACE FUNCTION public.listar_categorias_clientes_estatisticas(p_bar_id integer)
RETURNS TABLE(nome text, clientes integer, qtd_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, silver, pg_catalog
AS $$
  SELECT
    p->>'categoria' AS nome,
    COUNT(DISTINCT ce.cliente_fone_norm)::integer AS clientes,
    SUM((p->>'quantidade')::numeric) AS qtd_total
  FROM silver.cliente_estatisticas ce,
       jsonb_array_elements(ce.produtos_favoritos) p
  WHERE ce.bar_id = p_bar_id
    AND p->>'categoria' IS NOT NULL
    AND p->>'categoria' != ''
  GROUP BY p->>'categoria'
  ORDER BY qtd_total DESC;
$$;

CREATE OR REPLACE FUNCTION public.top_clientes_por_categoria(
  p_bar_id integer,
  p_categoria text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  nome text,
  telefone text,
  qtd_categoria numeric,
  vezes_pediu integer,
  produtos_distintos integer,
  top_produto_categoria text,
  total_visitas integer,
  ultima_visita date,
  dias_desde_ultima_visita integer,
  status text,
  eh_vip boolean,
  ticket_medio numeric,
  cliente_dtnasc date
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, silver, pg_catalog
AS $$
  WITH cat_agg AS (
    SELECT
      ce.cliente_nome,
      ce.cliente_fone_norm,
      SUM((p->>'quantidade')::numeric)::numeric AS qtd_categoria,
      SUM(COALESCE((p->>'vezes_pediu')::integer, 0))::integer AS vezes_pediu,
      COUNT(DISTINCT p->>'produto')::integer AS produtos_distintos,
      (array_agg(p->>'produto' ORDER BY (p->>'quantidade')::numeric DESC))[1] AS top_produto_categoria
    FROM silver.cliente_estatisticas ce,
         jsonb_array_elements(ce.produtos_favoritos) p
    WHERE ce.bar_id = p_bar_id
      AND p->>'categoria' = p_categoria
    GROUP BY ce.cliente_nome, ce.cliente_fone_norm
  )
  SELECT
    ca.cliente_nome AS nome,
    ca.cliente_fone_norm AS telefone,
    ca.qtd_categoria,
    ca.vezes_pediu,
    ca.produtos_distintos,
    ca.top_produto_categoria,
    ce.total_visitas,
    ce.ultima_visita,
    ce.dias_desde_ultima_visita,
    ce.status,
    ce.eh_vip,
    ce.ticket_medio_consumo AS ticket_medio,
    ce.cliente_dtnasc
  FROM cat_agg ca
  JOIN silver.cliente_estatisticas ce
    ON ce.bar_id = p_bar_id AND ce.cliente_fone_norm = ca.cliente_fone_norm
  ORDER BY ca.qtd_categoria DESC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_categorias_clientes_estatisticas(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.top_clientes_por_categoria(integer, text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.listar_categorias_clientes_estatisticas(integer) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.top_clientes_por_categoria(integer, text, integer) TO authenticated, service_role;
