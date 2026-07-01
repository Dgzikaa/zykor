-- Consumação com CUSTO REAL da ficha técnica (pedido do Gonza).
-- Por linha de desconto (bronze_contahub_avendas_porproduto_analitico):
--   produto com ficha (custo>0) → custo_ficha × qtd × (desconto/(desconto+valorfinal))  [proporcional ao desconto]
--   sem ficha (combo, R$ na conta, produto não cadastrado) → desconto × fator (35%)  [nada deixa de contar]
-- Classificação por categoria idêntica ao get_consumos_classificados_semana.
-- Retorna valor_desconto (preço venda dado) e custo_real por categoria.
-- Consumido por /api/cmv-semanal/buscar-dados-automaticos: usa o % efetivo (custo_real/valor_desconto)
-- por categoria no lugar do 35% flat, aplicado sobre o valor da base atual (silver.cliente_visitas).
create or replace function public.get_consumo_custo_real_semana(input_bar_id integer, input_data_inicio date, input_data_fim date, p_fator numeric default 0.35)
returns table(categoria text, valor_desconto numeric, custo_real numeric)
language plpgsql
set search_path to 'public','operations','financial','silver','bronze','gold','pg_catalog'
as $function$
declare v_cut date := public.consumo_padrao_cutoff();
begin
  return query
  with recursive
  expl as (
    select fi.produto_id as raiz, fi.componente_tipo ct, upper(fi.insumo_codigo) cod, fi.producao_ref,
           (fi.quantidade/coalesce(nullif(fi.fator_correcao,0),1))::numeric qtd_ef, 1::numeric fator, 0 lvl
    from public.producao_ficha_item fi where fi.produto_id is not null
    union all
    select e.raiz, fi.componente_tipo, upper(fi.insumo_codigo), fi.producao_ref,
           (fi.quantidade/coalesce(nullif(fi.fator_correcao,0),1))::numeric, e.fator*(e.qtd_ef/nullif(pb.rendimento,0)), e.lvl+1
    from expl e join public.producao_base pb on pb.id=e.producao_ref
    join public.producao_ficha_item fi on fi.producao_id=e.producao_ref
    where e.ct='producao' and e.lvl<6
  ),
  cust_ins as (
    select upper(codigo) cod,
      case when coalesce(nullif(embalagem,0), operations.derive_embalagem(nome, unidade_medida))>0
        then preco / coalesce(nullif(embalagem,0), operations.derive_embalagem(nome, unidade_medida)) else 0 end pu
    from silver.insumo_catalogo where bar_id=input_bar_id and preco is not null
  ),
  prod_cst as (
    select e.raiz produto_id, sum(e.qtd_ef*e.fator*coalesce(ci.pu,0)) custo
    from expl e left join cust_ins ci on ci.cod=e.cod
    where e.ct='insumo' group by e.raiz
  ),
  prd_map as (
    select m.prd::text prd, max(pcst.custo) custo
    from public.produto_contahub_map m
    join public.produto_cardapio pc on pc.bar_id=m.bar_id and pc.codigo=m.cod_interno
    join prod_cst pcst on pcst.produto_id=pc.id
    where m.bar_id=input_bar_id
    group by m.prd::text
  ),
  periodo_com_motivo as (
    select distinct on (vd_mesadesc) vd_mesadesc as mesa_p, vd_motivodesconto as motivo_p
    from bronze.bronze_contahub_avendas_vendasperiodo
    where bar_id = input_bar_id and vd_dtgerencial >= input_data_inicio and vd_dtgerencial <= input_data_fim
      and vd_motivodesconto is not null and vd_motivodesconto != ''
    order by vd_mesadesc, vd_dtgerencial desc
  ),
  linhas as (
    select ca.vd_mesadesc mesa, p.motivo_p motivo, ca.trn_dtgerencial data,
           ca.desconto, ca.qtd, ca.valorfinal, ca.prd::text prd
    from bronze.bronze_contahub_avendas_porproduto_analitico ca
    left join periodo_com_motivo p on ca.vd_mesadesc = p.mesa_p
    where ca.bar_id = input_bar_id and ca.trn_dtgerencial >= input_data_inicio and ca.trn_dtgerencial <= input_data_fim
      and ca.desconto > 0
  ),
  classif as materialized (
    select d.mesa, d.motivo, d.data,
      case when d.data >= v_cut then
        case public.classificar_consumo_padrao(d.motivo)
          when 'socios' then 'socios' when 'artistas' then 'artistas'
          when 'funcionarios_operacao' then 'funcionarios_operacao' when 'funcionarios_escritorio' then 'funcionarios_escritorio'
          when 'relacionamento' then 'clientes' when 'aniversario' then 'clientes' when 'programa_pontos' then 'clientes'
          when 'beneficio_cliente' then 'clientes' when 'influencer' then 'clientes' when 'ajuste_cmv' then 'clientes'
          else null end
      else nullif(public.classificar_consumo(d.mesa, d.motivo, input_bar_id), '_descartado') end as cat
    from (select distinct mesa, motivo, data from linhas) d
  ),
  linhas_cat as (
    select c.cat, l.desconto,
      case when pm.custo is not null and pm.custo > 0 and (l.desconto + coalesce(l.valorfinal,0)) > 0
        then pm.custo * l.qtd * (l.desconto / (l.desconto + coalesce(l.valorfinal,0)))
        else l.desconto * p_fator end as custo_linha
    from linhas l
    join classif c on c.mesa = l.mesa and c.motivo is not distinct from l.motivo and c.data = l.data
    left join prd_map pm on pm.prd = l.prd
    where c.cat is not null
  )
  select cat, round(sum(desconto)::numeric,2), round(sum(custo_linha)::numeric,2)
  from linhas_cat group by cat order by cat;
end $function$;
