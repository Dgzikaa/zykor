-- Tier 4 do roadmap RH: Portal do funcionário (acesso próprio por token/link, sem senha).
-- portal_token (link mágico /portal/<token>) por funcionário; o funcionário vê os dados
-- dele (escala, banco de horas) e pede folga/férias -> hr.solicitacoes (pendente).
-- Aprovação (manager) cria a ocorrência correspondente.
alter table hr.funcionarios add column if not exists portal_token uuid;
update hr.funcionarios set portal_token = gen_random_uuid() where portal_token is null;
create unique index if not exists idx_hr_func_portal_token on hr.funcionarios (portal_token);

create table if not exists hr.solicitacoes (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  tipo text not null,                       -- ferias | folga | outro
  data_inicio date not null,
  data_fim date,
  motivo text,
  status text not null default 'pendente',  -- pendente | aprovado | recusado
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists idx_hr_solicitacoes_bar on hr.solicitacoes (bar_id, status, criado_em desc);

grant select, insert, update, delete on hr.solicitacoes to service_role, authenticated;