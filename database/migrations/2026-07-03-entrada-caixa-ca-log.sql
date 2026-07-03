-- Idempotência do lançamento automático das entradas de dinheiro no Conta Azul (1 por bar/dia).
create table if not exists financial.entrada_caixa_ca_log (
  id             bigserial primary key,
  bar_id         integer     not null,
  dt_gerencial   date        not null,
  valor          numeric(14,2) not null,
  ca_protocol_id text,
  ca_status      text,
  baixado        boolean     not null default false,
  criado_por     text,
  created_at     timestamptz not null default now(),
  constraint uq_entrada_caixa_ca_log unique (bar_id, dt_gerencial)
);

comment on table financial.entrada_caixa_ca_log is
  'Log/idempotência do lançamento automático de contas-a-receber (dinheiro recebido) no Conta Azul, 1 por (bar, dia).';
