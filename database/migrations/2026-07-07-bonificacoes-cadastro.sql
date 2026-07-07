-- Cadastro de bonificações item-a-item (ideia do Gonza): a galera insere a bonificação quando ela
-- chega — fornecedor, valor, referente a quê, competência e data que chegou. Vira a fonte tanto da
-- Gestão CMV mensal quanto do lançamento no Conta Azul (1 lançamento por bonificação, categoria
-- "Ajuste Bonificações", sem baixa). Ex.: Ambev contrato, Diageo, extras de uniforme, etc.
create table if not exists financial.bonificacoes (
  id              bigserial primary key,
  bar_id          integer       not null,
  fornecedor      text          not null,
  referente       text,
  valor           numeric(14,2) not null,
  competencia     date          not null,              -- 1º dia do mês de competência
  data_chegada    date,
  categoria_nome  text          not null default 'Ajuste Bonificações',
  ca_lancado      boolean       not null default false,
  ca_protocol_id  text,
  ca_status       text,
  ca_categoria_id text,
  lancado_em      timestamptz,
  lancado_por     text,
  criado_por      text,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);
create index if not exists ix_bonificacoes_bar_comp on financial.bonificacoes (bar_id, competencia);

comment on table financial.bonificacoes is
  'Cadastro de bonificações (fornecedor, valor, referente, competência, data de chegada). Fonte para Gestão CMV mensal e para lançamento 1 a 1 no Conta Azul (categoria Ajuste Bonificações).';
