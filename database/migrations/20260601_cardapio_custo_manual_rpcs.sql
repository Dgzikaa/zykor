-- ============================================================================
-- RPCs de apoio ao preenchimento manual de custo de produto do cardapio
-- ----------------------------------------------------------------------------
-- Consumidas por /api/cardapio/custo-manual (GET lista / POST grava) e pela
-- secao "Produtos sem custo" em /ferramentas/analises/cardapio.
--
-- Escrita SEMPRE com bar_id vindo do backend autenticado (nunca do cliente).
-- ============================================================================

-- Lista produtos vendidos no periodo com custo efetivo (planilha-first) e flag.
CREATE OR REPLACE FUNCTION public.cardapio_produtos_custo(p_bar_id integer, p_dias integer DEFAULT 90)
 RETURNS TABLE(produto_codigo text, produto_desc text, categoria_mix text, qtd_vendida numeric,
               receita_total numeric, custo_contahub numeric, custo_manual numeric,
               custo_efetivo numeric, tem_custo boolean, fonte text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public','silver','operations'
AS $function$
  WITH base AS (
    SELECT
      v.produto_codigo,
      MAX(v.produto_desc)  AS produto_desc,
      MAX(v.categoria_mix) AS categoria_mix,
      SUM(v.quantidade)::numeric AS qtd_vendida,
      SUM(v.valor)::numeric      AS receita_total,
      SUM(v.custo)::numeric      AS custo_contahub
    FROM silver.vendas_item v
    WHERE v.bar_id = p_bar_id
      AND v.data_venda >= CURRENT_DATE - (p_dias || ' days')::interval
      AND v.quantidade > 0 AND v.valor > 0 AND v.produto_codigo IS NOT NULL
    GROUP BY v.produto_codigo
  )
  SELECT
    b.produto_codigo,
    b.produto_desc,
    b.categoria_mix,
    b.qtd_vendida,
    b.receita_total,
    b.custo_contahub,
    cm.custo_manual,
    COALESCE(cm.custo_manual * b.qtd_vendida, b.custo_contahub) AS custo_efetivo,
    COALESCE(cm.custo_manual * b.qtd_vendida, b.custo_contahub) > 0 AS tem_custo,
    CASE WHEN cm.custo_manual IS NOT NULL THEN COALESCE(cm.fonte,'manual')
         WHEN b.custo_contahub > 0 THEN 'contahub'
         ELSE NULL END AS fonte
  FROM base b
  LEFT JOIN operations.produto_custo_manual cm
    ON cm.bar_id = p_bar_id AND cm.produto_codigo = b.produto_codigo
  ORDER BY b.receita_total DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.cardapio_produtos_custo(integer, integer) TO authenticated, anon, service_role;

-- Upsert (ou remocao quando p_custo IS NULL) de custo manual de um produto.
CREATE OR REPLACE FUNCTION public.set_produto_custo_manual(
  p_bar_id integer, p_produto_codigo text, p_produto_desc text,
  p_custo numeric, p_preco_venda numeric DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public','operations'
AS $function$
BEGIN
  IF p_custo IS NULL OR p_custo < 0 THEN
    DELETE FROM operations.produto_custo_manual
     WHERE bar_id = p_bar_id AND produto_codigo = p_produto_codigo;
    RETURN;
  END IF;

  INSERT INTO operations.produto_custo_manual
    (bar_id, produto_codigo, produto_desc, custo_manual, preco_venda_planilha,
     codigo_planilha, match_tipo, fonte, atualizado_em)
  VALUES
    (p_bar_id, p_produto_codigo, p_produto_desc, p_custo, p_preco_venda,
     NULL, 'manual', 'manual', now())
  ON CONFLICT (bar_id, produto_codigo) DO UPDATE SET
    produto_desc         = COALESCE(EXCLUDED.produto_desc, operations.produto_custo_manual.produto_desc),
    custo_manual         = EXCLUDED.custo_manual,
    preco_venda_planilha = COALESCE(EXCLUDED.preco_venda_planilha, operations.produto_custo_manual.preco_venda_planilha),
    match_tipo           = 'manual',
    fonte                = 'manual',
    atualizado_em        = now();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_produto_custo_manual(integer, text, text, numeric, numeric) TO authenticated, service_role;
