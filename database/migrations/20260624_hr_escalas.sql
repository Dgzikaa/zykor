-- Tier 1 do roadmap RH (project_roadmap_rh_modulo): Escala/Turnos.
-- 1 linha = 1 funcionário escalado num dia. MVP: um turno por pessoa/dia
-- (unique funcionario_id,data); Folga/Falta são status.
create table if not exists hr.escalas (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  data date not null,
  turno text not null default 'Integral',          -- Manhã | Tarde | Noite | Integral
  area_id integer,
  hora_inicio time,
  hora_fim time,
  status text not null default 'planejado',          -- planejado | confirmado | folga | falta
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (funcionario_id, data)
);
create index if not exists idx_hr_escalas_bar_data on hr.escalas (bar_id, data);

grant select, insert, update, delete on hr.escalas to service_role, authenticated;