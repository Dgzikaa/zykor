-- Tier 2 do roadmap RH (project_roadmap_rh_modulo): Recrutamento (ATS leve).
-- Vaga -> candidatos por etapa (inscrito..contratado). Admitir cria o funcionário
-- (POST /api/rh/vagas/[id]/candidatos {admitir:true}) e seta funcionario_id.
create table if not exists hr.vagas (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  titulo text not null,
  area_id integer,
  tipo_contratacao text,
  descricao text,
  status text not null default 'aberta',
  criado_em timestamptz not null default now()
);
create index if not exists idx_hr_vagas_bar on hr.vagas (bar_id, status);

create table if not exists hr.candidatos (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  vaga_id uuid not null references hr.vagas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  etapa text not null default 'inscrito',
  observacao text,
  funcionario_id integer,
  criado_em timestamptz not null default now()
);
create index if not exists idx_hr_candidatos_vaga on hr.candidatos (vaga_id, etapa);

grant select, insert, update, delete on hr.vagas to service_role, authenticated;
grant select, insert, update, delete on hr.candidatos to service_role, authenticated;