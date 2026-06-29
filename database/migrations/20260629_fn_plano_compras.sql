-- Planejamento de Compras por insumo (espelha o de produção, termina em sugestão de COMPRA).
-- Validado pelo sócio (Gonza) 29/06. Modelo (planilha BASE_INGREDIENTES):
--   Saída = uso DIRETO do insumo em produtos (vendas qtd_consumo × ficha); base unit (ml/g).
--   AB = necessidade da PRODUÇÃO planejada (plano ENCERRADO da semana): receitas decididas
--        × insumo na ficha do preparo (elo Produção→Compras; mesma semana/contagem).
--   Estoque base = última contagem do início da semana × embalagem (contagem vem em pacotes).
--   Comprado = compras Vmarket da semana (gold.vmarket_pedido_item por cod_interno).
--   Sugestão de Compra = PR − Estoque + AB; Qtde = ROUNDUP(sugestão / embalagem). [no route]
-- Caveat: embalagem é TEXT em operations.insumos e muitos insumos têm unidade inconsistente
-- (cerveja lançada em ml na ficha mas embalagem=1) — a conversão p/ nº de embalagens depende
-- de limpar essa unidade (mesmo problema dos insumos da produção).
-- Aplicada em prod via MCP em 2026-06-29.
create or replace function gold.fn_plano_compras(p_bar integer, p_semana date default null)
 returns table(insumo_codigo text, nome text, fornecedor text, categoria text, embalagem numeric,
   unidade text, custo numeric, curva_a boolean, estoque_base numeric, ab numeric, comprado numeric,
   semanas date[], saidas numeric[])
 language sql stable security definer
 set search_path to 'gold','public','silver','operations'
as $function$
  with anchor as (select coalesce(p_semana, date_trunc('week', current_date)::date) as w),
  ins as (
    select upper(codigo) cod, nome, fornecedor, categoria, unidade_medida, custo_unitario, coalesce(curva_a,false) curva_a,
      case when embalagem ~ '^[0-9]+(\.[0-9]+)?$' then embalagem::numeric else 1 end embalagem
    from operations.insumos where bar_id=p_bar and coalesce(ativo,true) and codigo is not null
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
    select i.cod, i.nome, i.fornecedor, i.categoria, i.embalagem, i.unidade_medida, i.custo_unitario, i.curva_a,
      coalesce(e.estoque_final,0)*i.embalagem estoque_base,
      coalesce(ab.ab,0) ab, coalesce(cp.comprado,0) comprado, s.sem, coalesce(sr.saida,0) saida
    from ins i
    cross join semanas s
    left join saida_raw sr on sr.cod=i.cod and sr.sem=s.sem
    left join est e on e.cod=i.cod
    left join ab on ab.cod=i.cod
    left join comprado cp on cp.cod=i.cod
  )
  select fg.cod, fg.nome::text, fg.fornecedor::text, fg.categoria::text, fg.embalagem,
    fg.unidade_medida::text, fg.custo_unitario, fg.curva_a,
    max(fg.estoque_base) estoque_base, max(fg.ab) ab, max(fg.comprado) comprado,
    array_agg(fg.sem order by fg.sem) semanas,
    array_agg(round(fg.saida,4) order by fg.sem) saidas
  from full_grid fg
  group by fg.cod, fg.nome, fg.fornecedor, fg.categoria, fg.embalagem, fg.unidade_medida, fg.custo_unitario, fg.curva_a
  having sum(fg.saida) > 0 or max(fg.ab) > 0 or max(fg.comprado) > 0;
$function$;
grant execute on function gold.fn_plano_compras(integer, date) to authenticated, service_role, anon;
notify pgrst, 'reload schema';
