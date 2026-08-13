-- =============================================================================
-- Metas do período por bar, exibidas na home — 12/08/2026
-- =============================================================================
--
-- Pedido do Cadu: "nessa página inicial se pá vale colocar as metas do tri". Os quadros que
-- ele mandou são de SEMESTRE ("2º Sem"), cada bar com o seu tema e as suas métricas:
--
--   Ordinário  — "Segurar Gastos e Ver Dinheiro"
--                Faturamento R$ 10.000.000 · Clientes Ativos 6.500 · CMV Limpo 34%
--                (Atrações+Produção)/Fat 19% · CMO Fixo R$ 160.000
--   Deboche    — "Esquadrão e não deixar de lado"
--                CMO sem pró-labore 20% · CMV Limpo 34% · NPS 30 · NPS de Reservas 60
--
-- POR QUE TABELA E NÃO HARDCODE: as metas mudam a cada período e diferem por bar. Trocar
-- meta não pode exigir deploy.
--
-- O REALIZADO FICA DE FORA POR ORA, de propósito. "CMV Limpo" (limpo de quê?), "Clientes
-- Ativos" (ativo em que janela?) e "CMO Fixo" (a folha CLT vem de qual fonte?) não têm
-- definição fechada. Chutar a definição colocaria número errado na tela mais visível do
-- sistema, que é pior que número nenhum. A coluna `metrica_chave` já existe para ligar cada
-- linha à sua fonte quando a definição for decidida — hoje só faturamento e NPS estão ligados.
-- =============================================================================

create table if not exists operations.meta_periodo (
  id             uuid primary key default gen_random_uuid(),
  bar_id         integer not null,
  periodo_label  text not null,          -- "2º Sem"
  titulo         text,                   -- "Segurar Gastos e Ver Dinheiro"
  data_inicio    date not null,
  data_fim       date not null,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

create table if not exists operations.meta_periodo_item (
  id            uuid primary key default gen_random_uuid(),
  meta_id       uuid not null references operations.meta_periodo(id) on delete cascade,
  ordem         integer not null default 0,
  label         text not null,
  valor         numeric(14,2) not null,
  formato       text not null default 'numero' check (formato in ('moeda','percentual','numero')),
  metrica_chave text,
  observacao    text
);

create index if not exists idx_meta_periodo_bar on operations.meta_periodo (bar_id, ativo);

comment on column operations.meta_periodo_item.metrica_chave is
  'Liga a linha à fonte do realizado. Fica NULL enquanto a definição da métrica não estiver '
  'fechada (ex.: "CMV Limpo" — limpo de quê?). Sem isso a home mostraria número inventado.';

revoke all on operations.meta_periodo, operations.meta_periodo_item from anon;

-- ---- Seed: 2º semestre de 2026 ----
with ordi as (
  insert into operations.meta_periodo (bar_id, periodo_label, titulo, data_inicio, data_fim)
  select 3, '2º Sem', 'Segurar Gastos e Ver Dinheiro', date '2026-07-01', date '2026-12-31'
  where not exists (select 1 from operations.meta_periodo where bar_id=3 and periodo_label='2º Sem' and data_inicio=date '2026-07-01')
  returning id
)
insert into operations.meta_periodo_item (meta_id, ordem, label, valor, formato, metrica_chave)
select o.id, v.ordem, v.label, v.valor, v.formato, v.chave
from ordi o, (values
  (1, 'Faturamento',              10000000.00, 'moeda',      'faturamento'),
  (2, 'Clientes Ativos',              6500.00, 'numero',      null),
  (3, 'CMV Limpo',                      34.00, 'percentual',  null),
  (4, '(Atrações+Produção)/Fat',        19.00, 'percentual',  null),
  (5, 'CMO Fixo',                   160000.00, 'moeda',       null)
) as v(ordem, label, valor, formato, chave);

with deb as (
  insert into operations.meta_periodo (bar_id, periodo_label, titulo, data_inicio, data_fim)
  select 4, '2º Sem', 'Esquadrão e não deixar de lado', date '2026-07-01', date '2026-12-31'
  where not exists (select 1 from operations.meta_periodo where bar_id=4 and periodo_label='2º Sem' and data_inicio=date '2026-07-01')
  returning id
)
insert into operations.meta_periodo_item (meta_id, ordem, label, valor, formato, metrica_chave)
select d.id, v.ordem, v.label, v.valor, v.formato, v.chave
from deb d, (values
  (1, 'CMO sem pró-labore', 20.00, 'percentual', null),
  (2, 'CMV Limpo',          34.00, 'percentual', null),
  (3, 'NPS',                30.00, 'numero',     'nps'),
  (4, 'NPS de Reservas',    60.00, 'numero',     'nps_reservas')
) as v(ordem, label, valor, formato, chave);
