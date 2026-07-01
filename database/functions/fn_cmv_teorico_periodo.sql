CREATE OR REPLACE FUNCTION gold.fn_cmv_teorico_periodo(p_bar_id integer, p_ini date, p_fim date)
 RETURNS TABLE(codigo text, nome text, categoria text, fonte text, qtd numeric, qtd_consumo numeric, preco_venda numeric, custo_unit numeric, faturamento numeric, custo_total numeric, margem numeric, cmv_pct numeric, itens_ficha integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'silver'
AS $function$
  select pc.codigo, pc.nome, pc.categoria,
    v.fonte,
    sum(v.qtd_venda) qtd,
    sum(v.qtd_consumo) qtd_consumo,
    -- preço de venda por fonte: Yuzer = preço efetivo do evento (faturamento/qtd);
    -- ContaHub = preço de tabela do cardápio (gold.produto_cmv).
    case when v.fonte = 'yuzer' then round(sum(v.valor) / nullif(sum(v.qtd_venda), 0), 2)
         else max(pcmv.preco_venda) end preco_venda,
    max(pcmv.custo) custo_unit,
    sum(v.valor) faturamento,
    round(sum(v.qtd_venda * coalesce(pcmv.custo,0)),2) custo_total,
    round(sum(v.valor) - sum(v.qtd_venda*coalesce(pcmv.custo,0)),2) margem,
    case when sum(v.valor) > 0 then round(sum(v.qtd_venda*coalesce(pcmv.custo,0))/sum(v.valor)*100,2) else null end cmv_pct,
    coalesce(max(pcmv.itens_ficha),0)::int itens_ficha
  from silver.vendas_consolidada_dia v
  join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
  left join gold.produto_cmv pcmv on pcmv.bar_id=v.bar_id and pcmv.produto_id=pc.id
  where v.bar_id=p_bar_id and v.data between p_ini and p_fim
  group by pc.codigo, pc.nome, pc.categoria, v.fonte
  having sum(v.qtd_venda) > 0 or sum(v.valor) > 0
  order by sum(v.valor) desc;
$function$;
