-- Análises Stone pra tela /financeiro/conciliacao (abas): MDR por bandeira,
-- recebíveis (fluxo futuro), mix bandeiras/maquininhas, chargebacks.
-- Tudo agregado no banco (84k linhas) e devolvido como um único jsonb.
-- Dia operacional = capture_local_dt - 6h (mesma regra do gold).

create or replace function public.stone_analise(p_bar_id integer, p_de date, p_ate date)
returns jsonb
language sql
stable
security definer
set search_path = public, silver
as $$
with params as (
  select coalesce(p_de, current_date - 90) as de, coalesce(p_ate, current_date) as ate
),
base as (
  select t.*, (t.capture_local_dt - interval '6 hours')::date as op_day
  from silver.stone_transacoes t, params p
  where t.bar_id = p_bar_id
    and t.capture_local_dt >= (p.de::timestamp + interval '6 hours')
    and t.capture_local_dt <  ((p.ate + 1)::timestamp + interval '6 hours')
),
por_bandeira as (
  select brand_id, account_type, count(*) qtd,
         sum(gross_amount) bruto, sum(fee_amount) taxa, sum(net_amount) liquido
  from base group by brand_id, account_type
),
mdr_mensal as (
  select to_char(op_day,'YYYY-MM') mes, sum(gross_amount) bruto, sum(fee_amount) taxa
  from base group by 1 order by 1
),
por_maquininha as (
  select poi_serial_number poi, count(*) qtd, sum(gross_amount) bruto, sum(fee_amount) taxa
  from base where poi_serial_number is not null group by 1 order by sum(gross_amount) desc limit 40
),
por_hora as (
  select extract(hour from capture_local_dt)::int hora, count(*) qtd, sum(gross_amount) bruto
  from base group by 1 order by 1
),
por_dia_semana as (
  select extract(dow from op_day)::int dow, count(*) qtd, sum(gross_amount) bruto
  from base group by 1 order by 1
),
chargebacks as (
  select op_day, brand_id, account_type, gross_amount, card_number_masked, poi_serial_number,
         coalesce(ev_chargebacks,0) chargebacks, coalesce(ev_cancellations,0) cancelamentos
  from base where coalesce(ev_chargebacks,0) > 0 or coalesce(ev_cancellations,0) > 0
  order by op_day desc limit 300
),
a_receber as (
  select prevision_payment_date dt, sum(net_amount) liquido, count(*) qtd
  from silver.stone_transacoes
  where bar_id = p_bar_id and prevision_payment_date >= current_date
  group by 1 order by 1
),
repasses as (
  select reference_date dt, sum(total_amount) valor, count(*) qtd
  from silver.stone_pagamentos
  where bar_id = p_bar_id and reference_date between (select de from params) and (select ate from params)
  group by 1 order by 1 desc
)
select jsonb_build_object(
  'por_bandeira',   (select coalesce(jsonb_agg(to_jsonb(x) order by x.bruto desc),'[]') from por_bandeira x),
  'mdr_mensal',     (select coalesce(jsonb_agg(to_jsonb(x) order by x.mes),'[]') from mdr_mensal x),
  'por_maquininha', (select coalesce(jsonb_agg(to_jsonb(x) order by x.bruto desc),'[]') from por_maquininha x),
  'por_hora',       (select coalesce(jsonb_agg(to_jsonb(x) order by x.hora),'[]') from por_hora x),
  'por_dia_semana', (select coalesce(jsonb_agg(to_jsonb(x) order by x.dow),'[]') from por_dia_semana x),
  'chargebacks',    (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from chargebacks x),
  'a_receber',      (select coalesce(jsonb_agg(to_jsonb(x) order by x.dt),'[]') from a_receber x),
  'repasses',       (select coalesce(jsonb_agg(to_jsonb(x) order by x.dt desc),'[]') from repasses x),
  'totais', jsonb_build_object(
    'bruto',             (select coalesce(sum(bruto),0) from por_bandeira),
    'taxa',              (select coalesce(sum(taxa),0) from por_bandeira),
    'liquido',           (select coalesce(sum(liquido),0) from por_bandeira),
    'qtd',               (select coalesce(sum(qtd),0) from por_bandeira),
    'chargebacks_qtd',   (select count(*) from base where coalesce(ev_chargebacks,0) > 0),
    'cancelamentos_qtd', (select count(*) from base where coalesce(ev_cancellations,0) > 0),
    'a_receber_total',   (select coalesce(sum(liquido),0) from a_receber),
    'repasses_total',    (select coalesce(sum(valor),0) from repasses)
  )
);
$$;

grant execute on function public.stone_analise(integer, date, date) to authenticated, service_role, anon;