-- fn_plano_compras passa a devolver secao_vmarket (categoria de compra do VMarket), vinda de
-- silver.insumo_catalogo. Usado pra trocar o filtro de Fornecedor por "Seção VMarket" na tela.
-- DROP + CREATE porque mudou a assinatura de retorno. Aplicada em prod via MCP em 2026-06-29.
drop function if exists gold.fn_plano_compras(integer, date);
create or replace function gold.fn_plano_compras(p_bar integer, p_semana date default null)
 returns table(insumo_codigo text, nome text, fornecedor text, categoria text, secao_vmarket text,
   unidade_medida text, base text, embalagem numeric, custo numeric, curva_a boolean,
   estoque_cont numeric, ab numeric, comprado numeric, semanas date[], saidas numeric[])
 language sql stable security definer
 set search_path to 'gold','public','silver','operations'
as $function$
  with anchor as (select coalesce(p_semana, date_trunc('week', current_date)::date) as w),
  ins as (
    select upper(i.codigo) cod, i.nome, i.fornecedor, i.categoria, i.unidade_medida,
      i.custo_unitario, coalesce(i.curva_a,false) curva_a,
      c.base cat_base, c.secao_vmarket cat_secao,
      case when c.embalagem is not null and c.embalagem > 0 then c.embalagem::numeric else null end cat_emb
    from operations.insumos i
    left join silver.insumo_catalogo c on c.bar_id=i.bar_id and upper(c.codigo)=upper(i.codigo)
    where i.bar_id=p_bar and coalesce(i.ativo,true) and i.codigo is not null
  ),
  direta as (
    select fi.produto_id, upper(fi.insumo_codigo) cod, fi.quantidade::numeric qtd
    from public.producao_ficha_item fi
    where fi.componente_tipo='insumo' and fi.produto_id is not null and fi.insumo_codigo is not null
  ),
  semanas as (select ((select w from anchor) - (g*7))::date sem from generate_series(1,6) g),
  vendas as (
    select pc.id produto_id, date_trunc('week', v.data)::date sem, sum(v.qtd_consumo) qtd
    from silver.vendas_consolidada_dia v
    join public.produto_cardapio pc on pc.bar_id=v.bar_id and pc.codigo=v.cod_interno
    where v.bar_id=p_bar and v.data >= (select w from anchor) - 42 and v.data < (select w from anchor)
    group by 1,2
  ),
  saida_raw as (select d.cod, vd.sem, sum(vd.qtd*d.qtd) saida from direta d join vendas vd on vd.produto_id=d.produto_id group by 1,2),
  ab as (
    select upper(fi.insumo_codigo) cod, sum(pi.decidido_receitas * fi.quantidade) ab
    from operations.producao_plano pp
    join operations.producao_plano_item pi on pi.plano_id=pp.id
    join public.producao_ficha_item fi on fi.producao_id=pi.producao_id and fi.componente_tipo='insumo' and fi.insumo_codigo is not null
    where pp.bar_id=p_bar and pp.semana_ini=(select w from anchor) and pp.status='encerrado'
    group by 1
  ),
  est as (
    select distinct on (upper(insumo_codigo)) upper(insumo_codigo) cod, estoque_final
    from silver.estoque_contagem
    where bar_id=p_bar and data_contagem >= (select w from anchor) and data_contagem < (select w from anchor) + 7
    order by upper(insumo_codigo), data_contagem asc
  ),
  comprado as (
    select upper(it.cod_interno) cod, sum(it.quantidade) comprado
    from gold.vmarket_pedido_item it
    join gold.vmarket_pedido p on p.bar_id=it.bar_id and p.id_pedido=it.id_pedido
    where it.bar_id=p_bar and it.cod_interno is not null
      and p.data >= (select w from anchor) and p.data < (select w from anchor) + 7
    group by 1
  ),
  full_grid as (
    select i.cod, i.nome, i.fornecedor, i.categoria, i.cat_secao, i.unidade_medida, i.custo_unitario, i.curva_a,
      i.cat_base, i.cat_emb,
      coalesce(e.estoque_final,0) estoque_cont,
      coalesce(ab.ab,0) ab, coalesce(cp.comprado,0) comprado, s.sem, coalesce(sr.saida,0) saida
    from ins i
    cross join semanas s
    left join saida_raw sr on sr.cod=i.cod and sr.sem=s.sem
    left join est e on e.cod=i.cod
    left join ab on ab.cod=i.cod
    left join comprado cp on cp.cod=i.cod
  )
  select fg.cod, fg.nome::text, fg.fornecedor::text, fg.categoria::text, max(fg.cat_secao)::text secao_vmarket,
    fg.unidade_medida::text, max(fg.cat_base)::text base, max(fg.cat_emb) embalagem,
    fg.custo_unitario, fg.curva_a,
    max(fg.estoque_cont) estoque_cont, max(fg.ab) ab, max(fg.comprado) comprado,
    array_agg(fg.sem order by fg.sem) semanas,
    array_agg(round(fg.saida,4) order by fg.sem) saidas
  from full_grid fg
  group by fg.cod, fg.nome, fg.fornecedor, fg.categoria, fg.unidade_medida, fg.custo_unitario, fg.curva_a
  having sum(fg.saida) > 0 or max(fg.ab) > 0 or max(fg.comprado) > 0;
$function$;
grant execute on function gold.fn_plano_compras(integer, date) to authenticated, service_role, anon;
notify pgrst, 'reload schema';
