-- Reconciliação transação-a-transação Stone × ContaHub de um dia operacional.
-- ContaHub não tem NSU/autorização — só valor + tipo (Cred/Deb). Então o match é
-- por (tipo, valor) via multiset (row_number), e as que SOBRAM de cada lado são
-- as candidatas que explicam a diferença do dia.

create or replace function public.stone_dia_divergencias(p_bar_id integer, p_data date)
returns jsonb
language sql
stable
security definer
set search_path = public, silver
as $$
with stone as (
  select case when account_type in (2,4) then 'Cred' when account_type in (1,3) then 'Deb' else 'Outro' end as tipo,
         round(gross_amount, 2) as valor, capture_local_dt, brand_id, card_number_masked, issuer_authorization_code,
         row_number() over (partition by case when account_type in (2,4) then 'Cred' when account_type in (1,3) then 'Deb' else 'Outro' end, round(gross_amount,2) order by capture_local_dt) as rn
  from silver.stone_transacoes
  where bar_id = p_bar_id and (capture_local_dt - interval '6 hours')::date = p_data
),
ch as (
  select tipo, round(valor_bruto, 2) as valor, cliente_nome, mesa_desc, meio, created_at,
         row_number() over (partition by tipo, round(valor_bruto,2) order by created_at) as rn
  from silver.faturamento_pagamentos
  where bar_id = p_bar_id and data_pagamento = p_data and tipo in ('Cred','Deb')
),
cnt_stone as (select tipo, valor, count(*) n from stone group by 1,2),
cnt_ch as (select tipo, valor, count(*) n from ch group by 1,2),
so_stone as (
  select s.* from stone s left join cnt_ch c on c.tipo = s.tipo and c.valor = s.valor
  where s.rn > coalesce(c.n, 0)
),
so_ch as (
  select h.* from ch h left join cnt_stone c on c.tipo = h.tipo and c.valor = h.valor
  where h.rn > coalesce(c.n, 0)
)
select jsonb_build_object(
  'so_stone', (select coalesce(jsonb_agg(jsonb_build_object(
      'tipo', tipo, 'valor', valor, 'hora', capture_local_dt, 'brand_id', brand_id,
      'cartao', card_number_masked, 'autorizacao', issuer_authorization_code) order by valor desc),'[]') from so_stone),
  'so_ch', (select coalesce(jsonb_agg(jsonb_build_object(
      'tipo', tipo, 'valor', valor, 'cliente', cliente_nome, 'mesa', mesa_desc, 'meio', meio) order by valor desc),'[]') from so_ch),
  'resumo', jsonb_build_object(
    'so_stone_qtd', (select count(*) from so_stone),
    'so_stone_valor', (select coalesce(sum(valor),0) from so_stone),
    'so_ch_qtd', (select count(*) from so_ch),
    'so_ch_valor', (select coalesce(sum(valor),0) from so_ch)
  )
);
$$;

grant execute on function public.stone_dia_divergencias(integer, date) to authenticated, service_role, anon;