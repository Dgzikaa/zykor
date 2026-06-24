-- Tier 1 do roadmap RH (project_roadmap_rh_modulo): Ponto & banco de horas.
-- 1 registro por funcionário/dia. horas trabalhadas = (saida - entrada - intervalo),
-- vira-noite tratado no app; saldo = trabalhadas - previstas; banco de horas = soma.
create table if not exists hr.ponto_registro (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  data date not null,
  entrada time,
  saida time,
  intervalo_min integer not null default 0,
  horas_previstas numeric not null default 8,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (funcionario_id, data)
);
create index if not exists idx_hr_ponto_bar_data on hr.ponto_registro (bar_id, data);

grant select, insert, update, delete on hr.ponto_registro to service_role, authenticated;