-- Saída (vendas) do período POR CÓDIGO DE ORIGEM (ContaHub prd + Yuzer cod_yuzer) de cada
-- produto do cardápio (cod_interno). Espelha a lógica de dias Yuzer da matview
-- silver.vendas_consolidada_dia — em dia Yuzer usa o Yuzer, nos demais dias usa o ContaHub —
-- então a soma das origens reconcilia com gold.fn_cmv_teorico_periodo por (codigo, fonte).
-- Usado pela aba "Por período" do CMV Teórico p/ expandir o produto e ver o desempenho de
-- cada código separadamente (qtd, preço efetivo, faturamento, custo, CMV%). Custo = ficha
-- única do produto (gold.produto_cmv), igual à visão consolidada.
CREATE OR REPLACE FUNCTION gold.fn_cmv_teorico_periodo_origem(p_bar_id integer, p_ini date, p_fim date)
 RETURNS TABLE(codigo text, fonte text, cod_origem text, nome_origem text, qtd numeric, valor numeric, custo_unit numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'silver'
AS $function$
  with dias as (
    select bar_id, data_evento as data, bool_or(coalesce(usa_yuzer, false)) as usa_yuzer
    from operations.eventos_base group by bar_id, data_evento
  ),
  ch as (
    -- ContaHub: só dias NÃO-Yuzer (em dia Yuzer o pago vai pro Yuzer), granular por prd.
    select v.cod_interno, v.prd::text as cod_origem, max(v.prd_desc) as nome_origem,
      sum(v.qtd_venda) as qtd, sum(v.valor) as valor
    from silver.vendas_produto_dia v
    left join dias d on d.bar_id = v.bar_id and d.data = v.data
    where v.bar_id = p_bar_id and v.cod_interno is not null
      and v.data between p_ini and p_fim
      and coalesce(d.usa_yuzer, false) = false
    group by v.cod_interno, v.prd
    having sum(v.qtd_venda) > 0 or sum(v.valor) > 0
  ),
  yz as (
    -- Yuzer: só dias Yuzer, granular por cod_yuzer (líquido de devoluções, sem ingresso).
    select m.cod_interno, m.cod_yuzer as cod_origem, max(coalesce(m.nome, y.produto_nome)) as nome_origem,
      sum(greatest(coalesce(y.quantidade, 0) - coalesce(y.returned_quantity, 0), 0)) as qtd,
      sum(greatest(coalesce(y.valor_total, 0::numeric) - coalesce(y.returned_total, 0::numeric), 0::numeric)) as valor
    from silver.yuzer_produtos_evento y
    join produto_yuzer_map m on m.bar_id = y.bar_id and m.yuzer_produto_id = y.produto_id
    join dias d on d.bar_id = y.bar_id and d.data = y.data_evento and d.usa_yuzer
    where y.bar_id = p_bar_id and coalesce(y.eh_ingresso, false) = false and m.cod_interno is not null
      and y.data_evento between p_ini and p_fim
    group by m.cod_interno, m.cod_yuzer
    having sum(greatest(coalesce(y.quantidade, 0) - coalesce(y.returned_quantity, 0), 0)) > 0
  )
  select pc.codigo, 'contahub'::text as fonte, ch.cod_origem, ch.nome_origem,
    ch.qtd, ch.valor, pcmv.custo as custo_unit
  from ch
  join public.produto_cardapio pc on pc.bar_id = p_bar_id and pc.codigo = ch.cod_interno
  left join gold.produto_cmv pcmv on pcmv.bar_id = p_bar_id and pcmv.produto_id = pc.id
  union all
  select pc.codigo, 'yuzer'::text as fonte, yz.cod_origem, yz.nome_origem,
    yz.qtd, yz.valor, pcmv.custo as custo_unit
  from yz
  join public.produto_cardapio pc on pc.bar_id = p_bar_id and pc.codigo = yz.cod_interno
  left join gold.produto_cmv pcmv on pcmv.bar_id = p_bar_id and pcmv.produto_id = pc.id;
$function$;

grant execute on function gold.fn_cmv_teorico_periodo_origem(integer, date, date) to service_role;

notify pgrst, 'reload schema';
