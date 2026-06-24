-- Tier 2 do roadmap RH (project_roadmap_rh_modulo): Avaliação de desempenho.
-- Critérios em jsonb (flexível); nota_geral = média. Aba Avaliações do dossiê.
create table if not exists hr.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  periodo text not null,
  avaliador text,
  criterios jsonb not null default '[]'::jsonb,
  nota_geral numeric,
  pontos_fortes text,
  pontos_desenvolver text,
  status text not null default 'concluida',
  criado_em timestamptz not null default now()
);
create index if not exists idx_hr_avaliacoes_func on hr.avaliacoes (funcionario_id, criado_em desc);

grant select, insert, update, delete on hr.avaliacoes to service_role, authenticated;