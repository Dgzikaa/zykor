-- Reverte 20260714_consumos_9_precut_keyword: o pré-corte (< consumo_padrao_cutoff = 12/06)
-- volta a cair em 'outros' (não distribui por palavra-chave).
--
-- Decisão Gonza (15/07): a consumação ANTES do mapeamento automático por motivo deve ficar num
-- lump "Outros" (visível), não ser espalhada nas categorias. Pós-corte segue por motivo
-- (classificar_consumo_padrao). Isso vale pro Controle de Consumação e pro CMV SEMANAL (ContaHub).
--
-- OBS: NÃO resolve o "Controle ≠ CMV mensal" — o CMV mensal + DRE leem Conta Azul, não ContaHub
-- (fontes diferentes). A unificação da fonte no ContaHub ficou como decisão pendente
-- (muda CMV Real ~R$13k/mês e descola a DRE dos livros — aguardando ok Rodrigo/Gonza).

create or replace function public.get_consumos_9_detalhes_custo_semana(
  input_bar_id integer,
  input_data_inicio date,
  input_data_fim date,
  input_categoria text default null,
  p_fator numeric default 0.35,
  p_limit integer default null,
  p_offset integer default 0
)
returns table(
  categoria text, data date, mesa text, motivo text, prd_desc text,
  qtd numeric, valor_desconto numeric, custo_real numeric, tem_ficha boolean
)
language plpgsql
stable
set search_path to 'public','operations','financial','silver','bronze','gold','pg_catalog'
as $function$
#variable_conflict use_column
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
    where bar_id = input_bar_id
      and vd_dtgerencial >= input_data_inicio and vd_dtgerencial <= input_data_fim
      and vd_motivodesconto is not null and vd_motivodesconto != ''
    order by vd_mesadesc, vd_dtgerencial desc
  ),
  linhas as (
    select ca.vd_mesadesc as mesa, p.motivo_p as motivo, ca.trn_dtgerencial as data,
           ca.prd_desc, ca.qtd, ca.desconto, ca.valorfinal, ca.prd::text prd
    from bronze.bronze_contahub_avendas_porproduto_analitico ca
    left join periodo_com_motivo p on ca.vd_mesadesc = p.mesa_p
    where ca.bar_id = input_bar_id
      and ca.trn_dtgerencial >= input_data_inicio and ca.trn_dtgerencial <= input_data_fim
      and ca.desconto > 0
  ),
  classif as materialized (
    select d.mesa as mesa, d.motivo as motivo, d.data as data,
      case when d.data >= v_cut then public.classificar_consumo_padrao(d.motivo) else 'outros' end as cat
    from (select distinct l2.mesa, l2.motivo, l2.data from linhas l2) d
  )
  select c.cat, l.data, l.mesa, l.motivo, l.prd_desc,
         l.qtd::numeric, round(l.desconto::numeric, 2),
         round((case when pm.custo is not null and pm.custo > 0 and (l.desconto + coalesce(l.valorfinal,0)) > 0
           then pm.custo * l.qtd * (l.desconto / (l.desconto + coalesce(l.valorfinal,0)))
           else l.desconto * p_fator end)::numeric, 2) as custo_real,
         (pm.custo is not null and pm.custo > 0) as tem_ficha
  from linhas l
  join classif c on c.mesa = l.mesa and c.motivo is not distinct from l.motivo and c.data = l.data
  left join prd_map pm on pm.prd = l.prd
  where input_categoria is null or c.cat = input_categoria
  order by round(l.desconto::numeric, 2) desc, l.data, l.mesa, l.motivo, l.prd_desc, l.qtd
  limit p_limit offset coalesce(p_offset, 0);
end;
$function$;
