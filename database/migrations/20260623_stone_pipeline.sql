-- Pipeline de conciliação Stone: bronze (XML) -> silver (tipado) -> gold (cruzamento).
-- Aplicado em produção 2026-06-23 via MCP. Arquivo p/ registro/histórico.

-- ── SILVER: 1 linha por parcela ────────────────────────────────────────────
create table if not exists silver.stone_transacoes (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  stone_code text not null,
  empresa_nome text,
  reference_date date not null,
  acquirer_transaction_key text,
  initiator_transaction_key text,
  authorization_dt timestamptz,
  capture_local_dt timestamp,                  -- timestamp local da captura (p/ dia operacional)
  capture_date date,
  account_type integer, brand_id integer, entry_mode integer,
  number_of_installments integer, installment_number integer,
  card_number_masked text, international boolean,
  gross_amount numeric(14,6), net_amount numeric(14,6), fee_amount numeric(14,6),
  prevision_payment_date date,
  parsed_at timestamptz not null default now()
);
create index if not exists idx_stone_tx_bar_data on silver.stone_transacoes(bar_id, capture_date);
create index if not exists idx_stone_tx_ref on silver.stone_transacoes(bar_id, stone_code, reference_date);
grant select, insert, update, delete on silver.stone_transacoes to authenticated, service_role;
alter table bronze.bronze_stone_conciliacao add column if not exists parsed_em timestamptz;

-- Parser via xmltable (shred do XML em parcelas). Ver versão viva no banco.
-- silver.parse_stone_conciliacao(bar_id, stone_code, reference_date) -> int
-- silver.parse_stone_pendentes(forcar boolean) -> int (parseia o que tem xml_raw e parsed_em null)

-- ── GOLD: cruzamento diário Stone × ContaHub ───────────────────────────────
-- Alinha a captura Stone ao DIA OPERACIONAL (madrugada conta pro dia anterior,
-- corte 6h) -> bate com o dt_gerencial do ContaHub. Sem isso a diferença diária
-- vira ruído (testado: corte 0h=R$121k, corte 3h+=R$10,9k e estabiliza).
create or replace view gold.stone_conciliacao_diaria as
with stone as (
  select bar_id, (capture_local_dt - interval '6 hours')::date as data,
    sum(gross_amount) as stone_bruto, sum(net_amount) as stone_liquido, sum(fee_amount) as stone_taxa,
    count(distinct acquirer_transaction_key) as stone_transacoes,
    string_agg(distinct empresa_nome, ', ') as stone_cnpjs
  from silver.stone_transacoes where capture_local_dt is not null
  group by bar_id, 2
),
ch as (
  select bar_id, data_pagamento as data,
    sum(valor_bruto) filter (where tipo in ('Cred','Deb')) as ch_cartao,
    sum(valor_bruto) filter (where tipo='Cred') as ch_credito,
    sum(valor_bruto) filter (where tipo='Deb') as ch_debito
  from silver.faturamento_pagamentos
  where data_pagamento >= (select min((capture_local_dt - interval '6 hours')::date) from silver.stone_transacoes)
  group by bar_id, data_pagamento
)
select coalesce(s.bar_id, c.bar_id) as bar_id, coalesce(s.data, c.data) as data, s.stone_cnpjs,
  round(coalesce(c.ch_cartao,0),2) as contahub_cartao,
  round(coalesce(s.stone_bruto,0),2) as stone_bruto,
  round(coalesce(c.ch_cartao,0) - coalesce(s.stone_bruto,0),2) as diferenca,
  round(coalesce(s.stone_taxa,0),2) as stone_taxa, round(coalesce(s.stone_liquido,0),2) as stone_liquido,
  s.stone_transacoes, round(coalesce(c.ch_credito,0),2) as ch_credito, round(coalesce(c.ch_debito,0),2) as ch_debito,
  case when abs(coalesce(c.ch_cartao,0) - coalesce(s.stone_bruto,0)) <= greatest(50, 0.02*coalesce(c.ch_cartao,0))
       then 'ok' else 'verificar' end as status
from stone s
full join ch c on c.bar_id = s.bar_id and c.data = s.data
where coalesce(s.stone_bruto,0) > 0 or coalesce(c.ch_cartao,0) > 0;
grant select on gold.stone_conciliacao_diaria to authenticated, service_role, anon;
