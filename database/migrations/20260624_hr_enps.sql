-- Tier 4 do roadmap RH: Clima/eNPS recorrente (pulso anônimo).
-- Formulário público /pulse?bar=X grava aqui (sem funcionario_id = anônimo).
-- eNPS = %promotores(9-10) - %detratores(0-6) nos últimos 90 dias.
create table if not exists hr.enps_respostas (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  nota integer not null check (nota between 0 and 10),
  comentario text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_hr_enps_bar on hr.enps_respostas (bar_id, criado_em desc);

-- anon pode inserir (form público) e ler resultado é via service_role na API autenticada.
grant select, insert on hr.enps_respostas to service_role, authenticated, anon;