-- Idempotência dos lançamentos de FECHAMENTO enviados ao Conta Azul pelo Zykor:
--   Variação de Estoque (13), Bonificações (18), Consumações (12), Impostos Simulados (16),
--   Ajuste Receita Virada do Mês (6).
-- Cada linha = 1 lançamento no CA. Chave lógica (idempotência): (bar_id, tipo, competencia, chave).
--   tipo        = qual automação ('variacao_estoque' | 'bonificacao' | 'consumacao' | 'imposto' | 'ajuste_virada')
--   competencia = 1º dia do mês de competência (diários usam a data do dia)
--   chave       = discriminador dentro do tipo ('bebida'|'comida'|'drink'; tributo; categoria; sinal). '' quando único.
create table if not exists financial.lancamento_manual_ca_log (
  id               bigserial primary key,
  bar_id           integer       not null,
  tipo             text          not null,
  competencia      date          not null,
  chave            text          not null default '',
  sinal            text          not null default 'DESPESA', -- 'DESPESA' | 'RECEITA'
  valor            numeric(14,2) not null,
  descricao        text,
  categoria_id     text,
  categoria_nome   text,
  conta_id         text,
  data_vencimento  date,
  ca_protocol_id   text,
  ca_status        text,
  baixado          boolean       not null default false,
  criado_por       text,
  created_at       timestamptz   not null default now(),
  constraint uq_lancamento_manual_ca_log unique (bar_id, tipo, competencia, chave)
);

create index if not exists ix_lancamento_manual_ca_log_bar_tipo_comp
  on financial.lancamento_manual_ca_log (bar_id, tipo, competencia);

comment on table financial.lancamento_manual_ca_log is
  'Idempotência dos lançamentos de fechamento (Variação Estoque, Bonificações, Consumações, Impostos, Ajuste Virada) enviados ao Conta Azul via Zykor. 1 linha por lançamento; chave lógica (bar_id, tipo, competencia, chave). CA não tem DELETE, então cada (bar,tipo,competencia,chave) só é criado uma vez.';
