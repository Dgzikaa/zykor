-- Drill-down das 9 categorias de consumação do CMV Semanal (c9_*).
-- Espelha public.get_consumos_9_semana (agregada) mas devolve o detalhe linha-a-linha
-- (data, mesa, motivo, produto, qtd, desconto) classificado por categoria, pra o
-- modal de "ver o que tem lançado" em cada consumação (relacionamento, outros, etc.).
-- Mesma classificação por (mesa, motivo, data) via classificar_consumo_padrao com
-- corte 12/06; 'outros' = motivos não mapeados nas 9 + lançamentos pré-corte.

create or replace function public.get_consumos_9_detalhes_semana(
  input_bar_id integer, input_data_inicio date, input_data_fim date, input_categoria text default null)
returns table(categoria text, data date, mesa text, motivo text, prd_desc text, qtd numeric, valor_desconto numeric)
language plpgsql
stable
set search_path to 'public','operations','financial','system','integrations','bronze','silver','gold','crm','ops','pg_catalog'
as $function$
#variable_conflict use_column
declare v_cut date := public.consumo_padrao_cutoff();
begin
  return query
  with periodo_com_motivo as (
    select distinct on (vd_mesadesc) vd_mesadesc as mesa_p, vd_motivodesconto as motivo_p
    from bronze.bronze_contahub_avendas_vendasperiodo
    where bar_id = input_bar_id
      and vd_dtgerencial >= input_data_inicio and vd_dtgerencial <= input_data_fim
      and vd_motivodesconto is not null and vd_motivodesconto != ''
    order by vd_mesadesc, vd_dtgerencial desc
  ),
  linhas as (
    select ca.vd_mesadesc as mesa, p.motivo_p as motivo, ca.trn_dtgerencial as data,
           ca.prd_desc, ca.qtd, ca.desconto
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
         l.qtd::numeric, round(l.desconto::numeric, 2)
  from linhas l
  join classif c on c.mesa = l.mesa and c.motivo is not distinct from l.motivo and c.data = l.data
  where input_categoria is null or c.cat = input_categoria
  order by round(l.desconto::numeric, 2) desc;
end;
$function$;

grant execute on function public.get_consumos_9_detalhes_semana(integer, date, date, text) to authenticated, service_role, anon;