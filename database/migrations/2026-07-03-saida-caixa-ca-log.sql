-- Idempotência do lançamento manual de saídas de caixa (conta a pagar) no Conta Azul.
create table if not exists financial.saida_caixa_ca_log (
  id             bigserial primary key,
  bar_id         integer     not null,
  trn            integer     not null,
  num_lancamento integer     not null,
  dt_gerencial   date,
  descricao      text,
  valor          numeric(14,2) not null,
  categoria_id   text,
  conta_id       text,
  ca_protocol_id text,
  ca_status      text,
  baixado        boolean     not null default false,
  criado_por     text,
  created_at     timestamptz not null default now(),
  constraint uq_saida_caixa_ca_log unique (bar_id, trn, num_lancamento)
);

comment on table financial.saida_caixa_ca_log is
  'Log/idempotência do lançamento manual de saídas de caixa (conta a pagar) no Conta Azul, 1 por (bar, trn, num_lancamento).';
