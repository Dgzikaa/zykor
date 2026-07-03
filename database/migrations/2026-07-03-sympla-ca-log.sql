-- Idempotência do lançamento automático dos recebíveis Sympla no Conta Azul (1 por evento).
create table if not exists financial.sympla_ca_log (
  id             bigserial primary key,
  bar_id         integer     not null,
  event_id       bigint      not null,
  dt_evento      date,
  valor          numeric(14,2) not null,
  previsao_repasse date,
  descricao      text,
  ca_protocol_id text,
  ca_status      text,
  criado_por     text,
  created_at     timestamptz not null default now(),
  constraint uq_sympla_ca_log unique (bar_id, event_id)
);

comment on table financial.sympla_ca_log is
  'Log/idempotência do lançamento automático de contas-a-receber (repasse Sympla) no Conta Azul, 1 por evento. Sem baixa (recebido no depósito D+5, via conciliação futura).';
