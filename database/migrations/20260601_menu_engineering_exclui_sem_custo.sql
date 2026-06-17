-- ============================================================================
-- gold.menu_engineering: exclui produtos sem custo da classificacao
-- ----------------------------------------------------------------------------
-- Substitui a versao 20260601_menu_engineering_custo_planilha_first.sql.
-- Produtos sem custo efetivo (custo_total <= 0) saem da matriz Star/Plowhorse/
-- Puzzle/Dog (nao poluem mais com margem 100% falsa). Continuam visiveis na
-- secao "Produtos sem custo" da pagina (RPC public.cardapio_produtos_custo).
--
-- IMPORTANTE: `#variable_conflict use_column` + qualificar `calc.custo_total`
-- evitam ambiguidade com o parametro OUT `custo_total` da RETURNS TABLE
-- (sem isso a funcao quebra em runtime: "column reference custo_total is ambiguous").
-- ============================================================================

CREATE OR REPLACE FUNCTION gold.menu_engineering(p_bar_id integer, p_data_ini date, p_data_fim date)
 RETURNS TABLE(produto_codigo text, produto_desc text, grupo_desc text, categoria_mix text, qtd_vendida numeric, receita_total numeric, custo_total numeric, preco_medio numeric, custo_medio numeric, margem_unitaria numeric, margem_total numeric, margem_perc numeric, popularidade_norm numeric, margem_norm numeric, classificacao text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'gold', 'silver', 'operations'
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      v.produto_codigo,
      MAX(v.produto_desc)  AS produto_desc,
      MAX(v.grupo_desc)    AS grupo_desc,
      MAX(v.categoria_mix) AS categoria_mix,
      SUM(v.quantidade)::numeric AS qtd_vendida,
      SUM(v.valor)::numeric      AS receita_total,
      SUM(v.custo)::numeric      AS custo_contahub
    FROM silver.vendas_item v
    WHERE v.bar_id = p_bar_id
      AND v.data_venda BETWEEN p_data_ini AND p_data_fim
      AND v.quantidade > 0
      AND v.valor > 0
      AND v.produto_codigo IS NOT NULL
    GROUP BY v.produto_codigo
    HAVING SUM(v.quantidade) >= 5
  ),
  calc AS (
    SELECT
      b.produto_codigo,
      b.produto_desc,
      b.grupo_desc,
      b.categoria_mix,
      b.qtd_vendida,
      b.receita_total,
      COALESCE(cm.custo_manual * b.qtd_vendida, b.custo_contahub)                AS custo_total,
      (b.receita_total / NULLIF(b.qtd_vendida, 0))::numeric                       AS preco_medio,
      (COALESCE(cm.custo_manual * b.qtd_vendida, b.custo_contahub)
        / NULLIF(b.qtd_vendida, 0))::numeric                                      AS custo_medio,
      ((b.receita_total - COALESCE(cm.custo_manual * b.qtd_vendida, b.custo_contahub))
        / NULLIF(b.qtd_vendida, 0))::numeric                                      AS margem_unitaria,
      (b.receita_total - COALESCE(cm.custo_manual * b.qtd_vendida, b.custo_contahub))::numeric AS margem_total,
      ((b.receita_total - COALESCE(cm.custo_manual * b.qtd_vendida, b.custo_contahub))
        / NULLIF(b.receita_total, 0) * 100)::numeric                              AS margem_perc
    FROM base b
    LEFT JOIN operations.produto_custo_manual cm
      ON cm.bar_id = p_bar_id
     AND cm.produto_codigo = b.produto_codigo
  ),
  agg AS (
    SELECT * FROM calc WHERE calc.custo_total > 0   -- so produtos COM custo
  ),
  medianas AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY a.qtd_vendida)     AS med_qtd,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY a.margem_unitaria) AS med_margem
    FROM agg a
  )
  SELECT
    a.produto_codigo, a.produto_desc, a.grupo_desc, a.categoria_mix,
    a.qtd_vendida, a.receita_total, a.custo_total, a.preco_medio, a.custo_medio,
    a.margem_unitaria, a.margem_total, a.margem_perc,
    (a.qtd_vendida    / NULLIF(m.med_qtd, 0))::numeric    AS popularidade_norm,
    (a.margem_unitaria / NULLIF(m.med_margem, 0))::numeric AS margem_norm,
    CASE
      WHEN a.qtd_vendida >= m.med_qtd AND a.margem_unitaria >= m.med_margem THEN 'star'
      WHEN a.qtd_vendida >= m.med_qtd AND a.margem_unitaria <  m.med_margem THEN 'plowhorse'
      WHEN a.qtd_vendida <  m.med_qtd AND a.margem_unitaria >= m.med_margem THEN 'puzzle'
      ELSE 'dog'
    END AS classificacao
  FROM agg a CROSS JOIN medianas m
  ORDER BY a.receita_total DESC;
END;
$function$;
