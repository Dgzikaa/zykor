-- Cadastro de bonificações item-a-item (ideia do Gonza): a galera insere a bonificação quando ela
-- chega. Cada bonificação gera um PAR soma-zero no Conta Azul:
--   1 RECEITA (competencia_receita, categoria_receita) + 1 DESPESA (competencia_despesa = dia que
--   chegou, categoria_despesa), MESMO valor. Sem baixa. É a fonte da Gestão CMV mensal também.
-- Ex.: Ambev contrato, Diageo, extras de uniforme, etc.
drop table if exists financial.bonificacoes;
create table financial.bonificacoes (
  id                      bigserial primary key,
  bar_id                  integer       not null,
  fornecedor              text          not null,
  referente               text,
  valor                   numeric(14,2) not null,
  competencia_receita     date          not null,
  competencia_despesa     date          not null,   -- = dia que a bonificação chegou
  categoria_receita       text          not null,
  categoria_despesa       text          not null,
  ca_lancado              boolean       not null default false,   -- true quando as 2 pernas foram lançadas
  ca_receita_protocol_id  text, ca_receita_status text, ca_receita_categoria_id text,
  ca_despesa_protocol_id  text, ca_despesa_status text, ca_despesa_categoria_id text,
  lancado_em              timestamptz, lancado_por text,
  criado_por              text,
  created_at              timestamptz   not null default now(),
  updated_at              timestamptz   not null default now()
);
create index if not exists ix_bonificacoes_bar_desp on financial.bonificacoes (bar_id, competencia_despesa);

comment on table financial.bonificacoes is
  'Cadastro de bonificações. Cada uma gera um PAR soma-zero no CA: 1 RECEITA (competencia_receita, categoria_receita) + 1 DESPESA (competencia_despesa=dia que chegou, categoria_despesa), mesmo valor.';
