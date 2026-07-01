-- Stone → Conta Azul: lançamento automático de contas a receber (fim do dia).
-- Modelo B (confirmado com o sócio): bruto vira RECEITA, taxa vira DESPESA.
-- Agrupamento POR TIPO (crédito / débito / pix), somando bandeiras. Taxa = 1 despesa/dia.
-- Bar 3 primeiro (validação manual antes de ligar cron). PIX incluído.
--
-- Classificação do tipo pela JANELA DE LIQUIDAÇÃO (robusta a códigos novos de account_type):
--   account_type 99            -> PIX  (cai na hora; prevision_payment_date nulo)
--   liquidação > 15 dias        -> CREDITO (~D+30)
--   caso contrário              -> DEBITO  (~D+1/D+2)

-- 1) Log de idempotência: 1 lançamento por (bar, dia de venda, tipo).
--    Guard anti-duplicação — se a rota/cron rodar 2x no mesmo dia, não duplica no CA.
create table if not exists financial.stone_ca_lancamento_log (
  id            bigserial primary key,
  bar_id        integer     not null,
  data_venda    date        not null,
  tipo          text        not null,  -- CREDITO | DEBITO | PIX | TAXA
  valor         numeric     not null,
  ca_protocol_id text,
  ca_status     text,
  criado_em     timestamptz not null default now(),
  criado_por    text,
  unique (bar_id, data_venda, tipo)
);
comment on table financial.stone_ca_lancamento_log is
  'Idempotência dos lançamentos automáticos Stone->Conta Azul (1 por bar/dia/tipo: CREDITO/DEBITO/PIX/TAXA).';

-- 2) Agregação do dia: buckets por tipo (bruto/taxa/líquido) + vencimento.
create or replace function financial.stone_ca_lancamentos_dia(p_bar_id integer, p_data date)
returns table(tipo text, transacoes bigint, bruto numeric, taxa numeric, liquido numeric, vencimento date)
language sql stable
set search_path to 'financial','silver','public','pg_catalog'
as $$
  select
    case
      when s.account_type = 99 then 'PIX'
      when (s.prevision_payment_date - s.dt_gerencial) > 15 then 'CREDITO'
      else 'DEBITO'
    end as tipo,
    count(*)::bigint,
    round(sum(s.gross_amount), 2),
    round(sum(s.fee_amount), 2),
    round(sum(s.net_amount), 2),
    coalesce(max(s.prevision_payment_date), p_data) as vencimento
  from silver.stone_transacoes s
  where s.bar_id = p_bar_id
    and s.dt_gerencial = p_data
  group by 1;
$$;

comment on function financial.stone_ca_lancamentos_dia(integer, date) is
  'Buckets Stone do dia (CREDITO/DEBITO/PIX) com bruto/taxa/líquido e vencimento, p/ lançamento no CA.';

-- Grants: só service_role (a rota usa service role). NÃO expor pro anon (hardening).
grant execute on function financial.stone_ca_lancamentos_dia(integer, date) to service_role;
grant select, insert on financial.stone_ca_lancamento_log to service_role;
grant usage, select on sequence financial.stone_ca_lancamento_log_id_seq to service_role;
