-- DRE Eventos — Outras receitas SEM custo de produto (patrocínio, festival, etc.)
-- lançadas manualmente. valor = receita bruta (sem CMV); imposto = tributo pago sobre
-- a nota (informado pelo usuário). Consumida por /api/estrategico/orcamentacao/dre-excel
-- (modo=eventos): vira linha de Receita "Outras receitas (sem CMV)" + linha de Custo
-- Variável "Imposto s/ outras receitas", por competência (mês).
create table if not exists financial.dre_eventos_outras_receitas (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  competencia date not null,                -- primeiro dia do mês (YYYY-MM-01)
  descricao text,
  valor numeric(14,2) not null default 0,   -- receita bruta (sem CMV)
  imposto numeric(14,2) not null default 0, -- imposto pago sobre a nota (informado)
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_dre_ev_outras_bar_comp
  on financial.dre_eventos_outras_receitas (bar_id, competencia);

comment on table financial.dre_eventos_outras_receitas is
  'Outras receitas de eventos sem CMV (patrocínio/festival) lançadas manualmente na DRE Eventos; valor=receita, imposto=tributo informado.';
