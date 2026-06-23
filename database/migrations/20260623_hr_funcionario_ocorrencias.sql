-- Dossiê do funcionário: advertências, faltas, atestados, férias, observações.
-- Aplicado em produção 2026-06-23 via MCP. Arquivo p/ registro/histórico.
create table if not exists hr.funcionario_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  tipo text not null check (tipo in ('advertencia','falta','atestado','ferias','observacao')),
  data_inicio date not null,
  data_fim date,                          -- p/ período (férias/atestado)
  descricao text,
  documento_id uuid references hr.documentos_funcionario(id) on delete set null,
  created_by uuid,
  criado_em timestamptz not null default now()
);
create index if not exists idx_ocorr_func on hr.funcionario_ocorrencias(funcionario_id, data_inicio desc);
grant select, insert, update, delete on hr.funcionario_ocorrencias to authenticated, service_role;
