-- CMV Semanal — consumação = SÓ os 10 motivos parametrizados (decisão Gonza 23/06).
-- A partir do corte (consumo_padrao_cutoff, 12/06) a consumação no ContaHub é
-- parametrizada nos 10 motivos. Tudo fora disso (Happy Hour [HH], motivo vazio,
-- bilhetes tipo "Vou lançar no cnpj certo", arredondamento) NÃO é consumação e
-- não deve entrar no total do CMV.
--
-- Antes: get_consumos_classificados_semana usava classificar_consumo (antigo, 6 cat)
-- e fundia o lixo em 'clientes'/'artistas' → inflava a consumação (e o "Outros" da tela).

-- 1) Classificador padrão reconhece o 10º motivo "Ajuste CMV"
create or replace function public.classificar_consumo_padrao(p_motivo text)
returns text language sql immutable as $function$
  select case btrim(coalesce(p_motivo, ''))
    when 'Funcionário Operação'   then 'funcionarios_operacao'
    when 'Funcionário Escritório' then 'funcionarios_escritorio'
    when 'Aniversário'            then 'aniversario'
    when 'Programa de Pontos'     then 'programa_pontos'
    when 'Benefício Cliente'      then 'beneficio_cliente'
    when 'Influencer'             then 'influencer'
    when 'Artistas'               then 'artistas'
    when 'Sócios'                 then 'socios'
    when 'Relacionamento'         then 'relacionamento'
    when 'Ajuste CMV'             then 'ajuste_cmv'
    else 'outros'
  end;
$function$;

-- 2) Total da consumação (5 buckets do cmv_semanal) cutoff-aware:
--    pós-corte = classificador PARAMETRIZADO, mapeia os 10 -> 5 buckets, EXCLUI 'outros'
--    pré-corte = classificador antigo (preserva histórico, não zera)
create or replace function public.get_consumos_classificados_semana(input_bar_id integer, input_data_inicio date, input_data_fim date)
returns table(categoria text, total numeric)
language plpgsql
set search_path to 'public','operations','financial','system','integrations','bronze','silver','gold','crm','ops','pg_catalog'
as $function$
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
    select ca.vd_mesadesc as mesa, p.motivo_p as motivo, ca.trn_dtgerencial as data, ca.desconto
    from bronze.bronze_contahub_avendas_porproduto_analitico ca
    left join periodo_com_motivo p on ca.vd_mesadesc = p.mesa_p
    where ca.bar_id = input_bar_id
      and ca.trn_dtgerencial >= input_data_inicio and ca.trn_dtgerencial <= input_data_fim
      and ca.desconto > 0
  ),
  classif as materialized (
    select d.mesa, d.motivo, d.data,
      case when d.data >= v_cut then
        case public.classificar_consumo_padrao(d.motivo)
          when 'socios' then 'socios'
          when 'artistas' then 'artistas'
          when 'funcionarios_operacao' then 'funcionarios_operacao'
          when 'funcionarios_escritorio' then 'funcionarios_escritorio'
          when 'relacionamento' then 'clientes'
          when 'aniversario' then 'clientes'
          when 'programa_pontos' then 'clientes'
          when 'beneficio_cliente' then 'clientes'
          when 'influencer' then 'clientes'
          when 'ajuste_cmv' then 'clientes'
          else null
        end
      else nullif(public.classificar_consumo(d.mesa, d.motivo, input_bar_id), '_descartado')
      end as cat
    from (select distinct mesa, motivo, data from linhas) d
  )
  select c.cat, round(sum(l.desconto)::numeric, 2)
  from linhas l
  join classif c on c.mesa = l.mesa and c.motivo is not distinct from l.motivo and c.data = l.data
  where c.cat is not null
  group by c.cat
  order by c.cat;
end;
$function$;

-- Após aplicar: re-rodar a edge cmv-semanal-auto para as semanas pós-corte (>= 12/06)
-- dos 2 bares, pra regravar os buckets de consumação do cmv_semanal.