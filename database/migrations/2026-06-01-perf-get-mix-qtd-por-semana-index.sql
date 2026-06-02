-- PERF: get_mix_qtd_por_semana usava só EXTRACT(isoyear FROM data_venda)=p_ano no
-- WHERE, o que invalida o índice idx_vendas_item_mix(bar_id, data_venda, categoria_mix)
-- e força full-scan (~3,3s/ano). Adiciona um range de data SUPERSET (sargável) que o
-- índice usa via Bitmap Index Scan; o EXTRACT(isoyear) permanece pra exatidão (ano ISO
-- != ano calendário nas viradas). Resultado idêntico, ~5x mais rápido (3290ms -> 665ms).
-- Aplicada em produção via MCP em 2026-06-01.
CREATE OR REPLACE FUNCTION public.get_mix_qtd_por_semana(p_bar_id integer, p_ano integer)
 RETURNS TABLE(ano integer, numero_semana integer, qtd_bebidas numeric, qtd_drinks numeric, qtd_comida numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'silver', 'operations', 'pg_catalog'
AS $function$
  SELECT
    EXTRACT(isoyear FROM data_venda)::int  AS ano,
    EXTRACT(week    FROM data_venda)::int  AS numero_semana,
    COALESCE(SUM(quantidade) FILTER (WHERE categoria_mix = 'BEBIDA'), 0)::numeric AS qtd_bebidas,
    COALESCE(SUM(quantidade) FILTER (WHERE categoria_mix = 'DRINK'),  0)::numeric AS qtd_drinks,
    COALESCE(SUM(quantidade) FILTER (WHERE categoria_mix = 'COMIDA'), 0)::numeric AS qtd_comida
  FROM silver.vendas_item
  WHERE bar_id = p_bar_id
    AND data_venda >= make_date(p_ano - 1, 12, 26)
    AND data_venda <  make_date(p_ano + 1, 1, 6)
    AND EXTRACT(isoyear FROM data_venda) = p_ano
    AND tipo_transacao IN ('venda integral', 'com desconto', '100% desconto')
    AND categoria_mix IS NOT NULL
  GROUP BY 1, 2;
$function$;
