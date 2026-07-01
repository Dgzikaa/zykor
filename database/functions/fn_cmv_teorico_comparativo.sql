CREATE OR REPLACE FUNCTION gold.fn_cmv_teorico_comparativo(p_bar integer, p_ini date, p_fim date, p_ini_ant date, p_fim_ant date)
 RETURNS TABLE(cmv_atual numeric, cmv_ant numeric, fat_atual numeric, fat_ant numeric, mix_pp numeric, compras_pp numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'silver'
AS $function$
  with
  -- produtos COM ficha técnica (itens_ficha>0); os sem ficha ficam fora do CMV
  com_ficha as (
    select pc.codigo
    from public.produto_cardapio pc
    join gold.produto_cmv cm on cm.bar_id=p_bar and cm.produto_id=pc.id
    where pc.bar_id=p_bar and coalesce(cm.itens_ficha,0) > 0
  ),
  custo_atual as (
    select pc.codigo, coalesce(h.custo, cm.custo, 0) as c
    from public.produto_cardapio pc
    left join lateral (select custo from gold.produto_cmv_historico h
       where h.bar_id=p_bar and h.produto_id=pc.id and h.data_ref <= p_fim
       order by h.data_ref desc limit 1) h on true
    left join gold.produto_cmv cm on cm.bar_id=p_bar and cm.produto_id=pc.id
    where pc.bar_id=p_bar
  ),
  custo_ant as (
    select pc.codigo, coalesce(h.custo, cm.custo, 0) as c
    from public.produto_cardapio pc
    left join lateral (select custo from gold.produto_cmv_historico h
       where h.bar_id=p_bar and h.produto_id=pc.id and h.data_ref <= p_fim_ant
       order by h.data_ref desc limit 1) h on true
    left join gold.produto_cmv cm on cm.bar_id=p_bar and cm.produto_id=pc.id
    where pc.bar_id=p_bar
  ),
  v_atual as (
    select v.cod_interno cod, sum(v.qtd_consumo) q, sum(v.valor) fat
    from silver.vendas_consolidada_dia v
    where v.bar_id=p_bar and v.data between p_ini and p_fim
      and v.cod_interno in (select codigo from com_ficha)
    group by v.cod_interno
  ),
  v_ant as (
    select v.cod_interno cod, sum(v.qtd_consumo) q, sum(v.valor) fat
    from silver.vendas_consolidada_dia v
    where v.bar_id=p_bar and v.data between p_ini_ant and p_fim_ant
      and v.cod_interno in (select codigo from com_ficha)
    group by v.cod_interno
  ),
  s2 as (select sum(va.q*ca.c) custo, sum(va.fat) fat from v_atual va left join custo_atual ca on ca.codigo=va.cod),
  s1 as (select sum(vp.q*cp.c) custo, sum(vp.fat) fat from v_ant vp left join custo_ant cp on cp.codigo=vp.cod),
  smix as (select sum(va.q*coalesce(cp.c, ca.c)) custo, sum(va.fat) fat
           from v_atual va left join custo_ant cp on cp.codigo=va.cod left join custo_atual ca on ca.codigo=va.cod)
  select
    round(s2.custo/nullif(s2.fat,0)*100,2) cmv_atual,
    round(s1.custo/nullif(s1.fat,0)*100,2) cmv_ant,
    round(s2.fat,2) fat_atual, round(s1.fat,2) fat_ant,
    round((smix.custo/nullif(smix.fat,0)*100) - (s1.custo/nullif(s1.fat,0)*100),2) mix_pp,
    round((s2.custo/nullif(s2.fat,0)*100) - (smix.custo/nullif(smix.fat,0)*100),2) compras_pp
  from s2, s1, smix;
$function$;
