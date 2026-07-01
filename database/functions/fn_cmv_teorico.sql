CREATE OR REPLACE FUNCTION gold.fn_cmv_teorico(p_bar_id integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'gold', 'public', 'operations'
AS $function$
declare v int;
begin
  -- custo por unidade-base POR CÓDIGO (VMarket última compra > planilha). A ficha não usa SKU do VMarket.
  drop table if exists _cu;
  create temp table _cu as select codigo, custo_un from gold.insumo_custo_un where bar_id=p_bar_id and custo_un is not null;

  drop table if exists _prod;
  create temp table _prod as select pb.id, pb.rendimento, null::numeric custo_un, false resolvido from public.producao_base pb where pb.bar_id=p_bar_id;
  for i in 1..6 loop
    update _prod p set custo_un = case when p.rendimento>0 then x.total/p.rendimento else 0 end, resolvido=true
    from (select fi.producao_id,
        sum((case when fi.componente_tipo='insumo' then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0) + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
                 when fi.componente_tipo='producao' then coalesce(fi.quantidade,0)*coalesce(ref.custo_un,0) else 0 end) / coalesce(nullif(fi.fator_correcao,0),1)) total,
        bool_and(case when fi.componente_tipo='producao' then coalesce(ref.resolvido,false) else true end) all_ok
      from public.producao_ficha_item fi
      left join _cu cu on cu.codigo=fi.insumo_codigo left join _prod ref on ref.id=fi.producao_ref
      where fi.producao_id is not null group by fi.producao_id) x
    where p.id=x.producao_id and not p.resolvido and x.all_ok;
  end loop;

  delete from gold.produto_cmv where bar_id=p_bar_id;
  insert into gold.produto_cmv (bar_id, produto_id, codigo, nome, categoria, ativo, custo, preco_venda, cmv_pct, margem, itens_ficha)
  select p_bar_id, pc.id, pc.codigo, pc.nome, pc.categoria, pc.ativo, fc.custo, pv.preco_venda,
    case when pv.preco_venda>0 and fc.custo is not null then round(fc.custo/pv.preco_venda*100,2) else null end,
    case when pv.preco_venda>0 and fc.custo is not null then round(pv.preco_venda-fc.custo,2) else null end, coalesce(fc.itens,0)
  from public.produto_cardapio pc
  left join lateral (select count(*) itens, sum((case
      when fi.componente_tipo='insumo' then coalesce(fi.quantidade,0)*coalesce(cu.custo_un,0) + case when cu.custo_un is null then coalesce(fi.custo_planilha,0) else 0 end
      when fi.componente_tipo='producao' then coalesce(fi.quantidade,0)*coalesce(ref.custo_un,0) else 0 end) / coalesce(nullif(fi.fator_correcao,0),1)) custo
    from public.producao_ficha_item fi
    left join _cu cu on cu.codigo=fi.insumo_codigo left join _prod ref on ref.id=fi.producao_ref
    where fi.produto_id=pc.id) fc on true
  left join lateral (select coalesce(
      (select max(m.preco_venda) from public.produto_contahub_map m where m.bar_id=p_bar_id and m.cod_interno=pc.codigo and m.preco_venda>0),
      (select py.preco_yuzer from gold.produto_preco_yuzer py where py.bar_id=p_bar_id and py.cod_interno=pc.codigo)
    ) preco_venda) pv on true
  where pc.bar_id=p_bar_id;
  update gold.produto_cmv v
  set custo = p.custo, preco_venda = p.preco_venda, cmv_pct = p.cmv_pct, margem = p.margem, itens_ficha = p.itens_ficha
  from public.produto_cardapio pcv
  join gold.produto_cmv p on p.bar_id=p_bar_id and p.codigo = pcv.agrupado_em
  where v.bar_id=p_bar_id and v.codigo = pcv.codigo and pcv.bar_id=p_bar_id and pcv.agrupado_em is not null;
  get diagnostics v=row_count; return v;
end $function$;
