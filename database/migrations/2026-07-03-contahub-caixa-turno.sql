-- =============================================================================
-- ContaHub — Saída de dinheiro do caixa (sangria) por turno
-- Fonte: GerenciaCmd/getRelatorioTurnoHtml (seção "Lançamentos do CAIXA")
-- Ingestão: edge function contahub-caixa-turno-sync (login reutilizado do sync)
-- Camada: bronze (raw parseado) -> silver (views de consumo)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BRONZE: um registro por lançamento de caixa com nº (#) — entradas e saídas.
-- Linhas-resumo (Turno Anterior / Saldo Final / Recebimentos) NÃO entram aqui
-- (não têm nº de lançamento).
-- ---------------------------------------------------------------------------
create table if not exists bronze.bronze_contahub_caixa_turno (
  id              bigserial primary key,
  bar_id          integer     not null,
  emp_id          text        not null,
  trn             integer     not null,
  dt_gerencial    date,
  num_lancamento  integer     not null,
  descricao       text,                       -- motivo canônico (coluna descrição do ContaHub)
  entrada         numeric(14,2),
  saida           numeric(14,2),
  obs             text,
  source          text        not null default 'getRelatorioTurnoHtml',
  captured_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_caixa_turno_bar_trn_num unique (bar_id, trn, num_lancamento)
);

comment on table bronze.bronze_contahub_caixa_turno is
  'Lançamentos de caixa por turno do ContaHub (getRelatorioTurnoHtml). saida = dinheiro que saiu do caixa (sangria/retirada). Idempotente por (bar_id, trn, num_lancamento).';

create index if not exists idx_caixa_turno_bar_dt on bronze.bronze_contahub_caixa_turno (bar_id, dt_gerencial);
create index if not exists idx_caixa_turno_saida  on bronze.bronze_contahub_caixa_turno (bar_id, dt_gerencial) where saida is not null;

-- ---------------------------------------------------------------------------
-- SILVER: saídas de dinheiro do caixa (o que interessa) — 1 linha por saída.
-- ---------------------------------------------------------------------------
create or replace view silver.contahub_caixa_saida as
select
  b.bar_id,
  b.dt_gerencial,
  b.trn,
  b.num_lancamento,
  b.descricao as motivo,
  b.saida     as valor_saida,
  b.obs
from bronze.bronze_contahub_caixa_turno b
where b.saida is not null
  and b.saida > 0;

comment on view silver.contahub_caixa_saida is
  'Saídas de dinheiro do caixa (sangria/retirada) por turno, 1 linha por lançamento. motivo = coluna descrição do ContaHub.';

-- ---------------------------------------------------------------------------
-- SILVER: resumo por turno (total saídas / entradas).
-- ---------------------------------------------------------------------------
create or replace view silver.contahub_caixa_turno_resumo as
select
  b.bar_id,
  b.dt_gerencial,
  b.trn,
  count(*) filter (where b.saida is not null and b.saida > 0)       as qtd_saidas,
  coalesce(sum(b.saida)   filter (where b.saida  > 0), 0)::numeric(14,2) as total_saidas,
  coalesce(sum(b.entrada) filter (where b.entrada > 0), 0)::numeric(14,2) as total_entradas,
  max(b.captured_at) as capturado_em
from bronze.bronze_contahub_caixa_turno b
group by b.bar_id, b.dt_gerencial, b.trn;

comment on view silver.contahub_caixa_turno_resumo is
  'Resumo de caixa por turno: total de saídas (sangria) e entradas.';
