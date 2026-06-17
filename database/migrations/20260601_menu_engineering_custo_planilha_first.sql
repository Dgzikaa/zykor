-- ============================================================================
-- gold.menu_engineering: custo planilha-first
-- ----------------------------------------------------------------------------
-- Regra de negocio (definida com o usuario): a planilha de Engenharia de
-- Cardapio e a fonte da verdade de custo. Quando existe custo manual para o
-- produto em operations.produto_custo_manual, ele tem prioridade sobre o custo
-- do ContaHub; senao, cai no custo do ContaHub (silver.vendas_item.custo).
--
--   custo_total = COALESCE(custo_manual * qtd_vendida, SUM(custo_contahub))
--
-- Assinatura (RETURNS TABLE) mantida identica a versao anterior para nao
-- quebrar public.menu_engineering nem a API /api/cardapio/engenharia.
-- ============================================================================

CREATE OR REPLACE FUNCTION gold.menu_engineering(p_bar_id integer, p_data_ini date, p_data_fim date)
 RETURNS TABLE(produto_codigo text, produto_desc text, grupo_desc text, categoria_mix text, qtd_vendida numeric, receita_total numeric, custo_total numeric, preco_medio numeric, custo_medio numeric, margem_unitaria numeric, margem_total numeric, margem_perc numeric, popularidade_norm numeric, margem_norm numeric, classificacao text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'gold', 'silver', 'operations'
AS $function$
BEGIN
  RETURN QUERY
  -- 1) Agrega vendas no periodo
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
  -- 2) Custo planilha-first: custo manual (unitario) tem prioridade sobre o do ContaHub
  agg AS (
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
  -- 3) Medianas (eixos da matriz) sobre o custo final
  medianas AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY a.qtd_vendida)     AS med_qtd,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY a.margem_unitaria) AS med_margem
    FROM agg a
  )
  SELECT
    a.produto_codigo,
    a.produto_desc,
    a.grupo_desc,
    a.categoria_mix,
    a.qtd_vendida,
    a.receita_total,
    a.custo_total,
    a.preco_medio,
    a.custo_medio,
    a.margem_unitaria,
    a.margem_total,
    a.margem_perc,
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
