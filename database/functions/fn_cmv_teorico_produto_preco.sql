CREATE OR REPLACE FUNCTION gold.fn_cmv_teorico_produto_preco(p_bar integer, p_ini date, p_fim date, p_ref date)
 RETURNS TABLE(codigo text, nome text, categoria text, qtd numeric, faturamento numeric, custo_unit numeric, preco_venda numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'operations', 'silver'
AS $function$
begin
  drop table if exists _cu;
  create temp table _cu as select x.codigo as cod, x.custo_un from gold.fn_insumo_custo_un_asof(p_bar, p_ref) x where x.custo_un is not null;
  drop table if exists _prod;
  create temp table _prod as select pb.id, pb.rendimento, null::numeric custo_un, false resolvido from public.producao_base pb where pb.bar_id=p_bar;
  for i in 1..6 loop
    update _prod p set custo_un = case when p.rendimento>0 then x.total/p.rendimento else 0 end, resolvido=true
    from (select fi.producao_id,
        sum((case when fi.componente_tipo='insumo' then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0) + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
                 when fi.componente_tipo='producao' then coalesce(fi.quantidade,0)*coalesce(ref.custo_un,0) else 0 end) / coalesce(nullif(fi.fator_correcao,0),1)) total,
        bool_and(case when fi.componente_tipo='producao' then coalesce(ref.resolvido,false) else true end) all_ok
      from public.producao_ficha_item fi
      left join _cu cu on cu.cod=fi.insumo_codigo left join _prod ref on ref.id=fi.producao_ref
      where fi.producao_id is not null group by fi.producao_id) x
    where p.id=x.producao_id and not p.resolvido and x.all_ok;
  end loop;
  return query
  with custo as (
    select pc.codigo as pcod,
      (select sum((case
          when fi.componente_tipo='insumo' then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0) + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
          when fi.componente_tipo='producao' then coalesce(fi.quantidade,0)*coalesce(rf.custo_un,0) else 0 end) / coalesce(nullif(fi.fator_correcao,0),1))
        from public.producao_ficha_item fi
        left join _cu cu on cu.cod=fi.insumo_codigo left join _prod rf on rf.id=fi.producao_ref
        where fi.produto_id=pc.id) cunit
    from public.produto_cardapio pc where pc.bar_id=p_bar
  ),
  vendas as (
    select pc.codigo as pcod, pc.nome as pnome,
      case lower(left(pc.codigo,1)) when 'b' then 'Bebida' when 'd' then 'Drink' when 'c' then 'Comida' when 'o' then 'Outros' else pc.categoria end cat,
      sum(v.qtd_venda) q, sum(v.valor) fat
    from silver.vendas_consolidada_dia v
    join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    -- só produtos COM ficha técnica entram no CMV (alinhado ao headline)
    join gold.produto_cmv cm on cm.bar_id=pc.bar_id and cm.produto_id=pc.id and coalesce(cm.itens_ficha,0) > 0
    where v.bar_id=p_bar and v.data between p_ini and p_fim group by 1,2,3
    having sum(v.valor) > 0
  )
  select vd.pcod, vd.pnome::text, vd.cat::text, vd.q, round(vd.fat,2),
    round(coalesce(c.cunit,0),4), round(vd.fat/nullif(vd.q,0),2)
  from vendas vd left join custo c on c.pcod=vd.pcod;
end $function$;
