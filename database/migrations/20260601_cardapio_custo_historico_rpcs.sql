-- ============================================================================
-- RPCs da aba "Historico de precos" (/ferramentas/analises/cardapio)
-- ----------------------------------------------------------------------------
-- Consumidas por /api/cardapio/custo-historico e pelo componente HistoricoPrecos.
-- ============================================================================

-- Mudancas de custo/preco por bar (o que mudou e quando).
CREATE OR REPLACE FUNCTION public.cardapio_custo_mudancas(p_bar_id integer, p_dias integer DEFAULT 90)
 RETURNS TABLE(produto_codigo text, produto_desc text, data_mudanca date, data_anterior date,
               custo_anterior numeric, custo_novo numeric,
               preco_anterior numeric, preco_novo numeric, fonte text)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public','operations'
AS $function$
  SELECT produto_codigo, produto_desc, data_mudanca, data_anterior,
         custo_anterior, custo_novo, preco_anterior, preco_novo, fonte
  FROM operations.produto_custo_mudancas
  WHERE bar_id = p_bar_id
    AND data_mudanca >= CURRENT_DATE - (p_dias || ' days')::interval
  ORDER BY data_mudanca DESC, produto_desc;
$function$;
GRANT EXECUTE ON FUNCTION public.cardapio_custo_mudancas(integer, integer) TO authenticated, anon, service_role;

-- Serie temporal (evolucao) de custo/preco de UM produto.
CREATE OR REPLACE FUNCTION public.cardapio_custo_serie(p_bar_id integer, p_produto_codigo text, p_dias integer DEFAULT 180)
 RETURNS TABLE(snapshot_date date, custo numeric, preco numeric)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public','operations'
AS $function$
  SELECT snapshot_date, custo_manual, preco_venda_planilha
  FROM operations.produto_custo_historico
  WHERE bar_id = p_bar_id
    AND produto_codigo = p_produto_codigo
    AND snapshot_date >= CURRENT_DATE - (p_dias || ' days')::interval
  ORDER BY snapshot_date;
$function$;
GRANT EXECUTE ON FUNCTION public.cardapio_custo_serie(integer, text, integer) TO authenticated, anon, service_role;
