-- Tier 1 do roadmap RH (project_roadmap_rh_modulo): Freelas.
-- Pool = hr.funcionarios tipo_contratacao='Freela'. Convocação por data (evento/turno);
-- pagamento via PIX usa a chave do funcionário. Status: convocado/confirmado/recusado/
-- compareceu/faltou. "A pagar" = quem confirmou ou compareceu.
create table if not exists hr.freela_convocacao (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  data date not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  status text not null default 'convocado',
  valor_diaria numeric,
  funcao text,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (funcionario_id, data)
);
create index if not exists idx_hr_freela_bar_data on hr.freela_convocacao (bar_id, data);

grant select, insert, update, delete on hr.freela_convocacao to service_role, authenticated;