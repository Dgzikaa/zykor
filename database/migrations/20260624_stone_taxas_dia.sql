-- Detalhe por dia de uma bandeira+tipo na aba Taxas (MDR) — modal ao clicar na linha.
-- Mesma base do stone_analise (silver.stone_transacoes, dia operacional = dt_gerencial/corte 6h),
-- então a soma dos dias bate com o total da linha. Formato Valor/dia/bandeira/tipo (igual ao
-- que se lança/concilia no financeiro).
CREATE OR REPLACE FUNCTION public.stone_taxas_dia(p_bar_id integer, p_de date, p_ate date, p_brand_id integer, p_account_type integer)
 RETURNS TABLE(data date, qtd bigint, bruto numeric, taxa numeric, liquido numeric, mdr numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','silver'
AS $function$
  SELECT t.dt_gerencial, count(*)::bigint,
         sum(t.gross_amount)::numeric(14,2), sum(t.fee_amount)::numeric(14,2), sum(t.net_amount)::numeric(14,2),
         CASE WHEN sum(t.gross_amount) > 0 THEN round(sum(t.fee_amount)/sum(t.gross_amount)*100, 2) ELSE 0 END
  FROM silver.stone_transacoes t
  WHERE t.bar_id = p_bar_id AND t.dt_gerencial BETWEEN p_de AND p_ate
    AND t.brand_id IS NOT DISTINCT FROM p_brand_id
    AND t.account_type IS NOT DISTINCT FROM p_account_type
  GROUP BY t.dt_gerencial ORDER BY t.dt_gerencial DESC;
$function$;
GRANT EXECUTE ON FUNCTION public.stone_taxas_dia(integer,date,date,integer,integer) TO anon, authenticated, service_role;
