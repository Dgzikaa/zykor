-- Tier 2 do roadmap RH (project_roadmap_rh_modulo): Treinamentos & certificações.
-- Ex.: Manipulação de Alimentos, Brigada de Incêndio. validade -> alerta automático
-- (computarAlertas em lib/rh/alertas: tipo 'treino_vencido').
create table if not exists hr.treinamentos (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  nome text not null,
  instituicao text,
  data_conclusao date,
  validade date,
  observacao text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_hr_treinamentos_func on hr.treinamentos (funcionario_id, criado_em desc);
create index if not exists idx_hr_treinamentos_validade on hr.treinamentos (bar_id, validade);

grant select, insert, update, delete on hr.treinamentos to service_role, authenticated;