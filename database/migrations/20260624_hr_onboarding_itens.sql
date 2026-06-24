-- Tier 2 do roadmap RH (project_roadmap_rh_modulo): Onboarding (checklist de admissão).
-- Itens padrão semeados no 1º acesso (lazy seed na API GET); itens custom permitidos.
create table if not exists hr.onboarding_itens (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  item text not null,
  concluido boolean not null default false,
  concluido_em timestamptz,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (funcionario_id, item)
);
create index if not exists idx_hr_onboarding_func on hr.onboarding_itens (funcionario_id, ordem);

grant select, insert, update, delete on hr.onboarding_itens to service_role, authenticated;