CREATE OR REPLACE FUNCTION gold.fn_cmv_teorico_vs_real(p_bar_id integer, p_ano integer)
 RETURNS TABLE(mes integer, fat_teorico numeric, custo_teorico numeric, cmv_teorico_pct numeric, fat_cmvivel numeric, cmv_real numeric, cmv_real_pct numeric, gap_pp numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'silver', 'financial'
AS $function$
  with teo as (
    select extract(month from v.data)::int mes,
      sum(v.valor) fat, sum(v.qtd_venda * coalesce(pcmv.custo,0)) custo
    from silver.vendas_consolidada_dia v
    join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    -- só produtos COM ficha técnica entram no teórico (itens_ficha>0)
    join gold.produto_cmv pcmv on pcmv.bar_id=v.bar_id and pcmv.produto_id=pc.id and coalesce(pcmv.itens_ficha,0) > 0
    where v.bar_id=p_bar_id and extract(year from v.data)=p_ano
    group by 1
  ), re as (
    select mes, faturamento_cmvivel, cmv_real, cmv_real_percentual
    from financial.cmv_mensal where bar_id=p_bar_id and ano=p_ano
  )
  select coalesce(t.mes,r.mes) mes,
    round(t.fat,2), round(t.custo,2),
    case when t.fat>0 then round(t.custo/t.fat*100,2) end,
    r.faturamento_cmvivel, r.cmv_real, r.cmv_real_percentual,
    case when t.fat>0 and r.cmv_real_percentual is not null then round(r.cmv_real_percentual - t.custo/t.fat*100,2) end
  from teo t full join re r on r.mes=t.mes
  order by 1;
$function$;
