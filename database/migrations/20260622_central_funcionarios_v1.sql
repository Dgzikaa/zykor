-- Central de Funcionários v1: estende hr.funcionarios + banco de documentos + tipo Freela.
-- Âncora = hr.funcionarios (57 vivos, alimenta o CMO — não recriar).

-- 1) Liberar tipo de contratação 'Freela' (hoje só CLT/PJ)
do $$
declare cn text;
begin
  select conname into cn from pg_constraint
   where conrelid='hr.funcionarios'::regclass and contype='c'
     and pg_get_constraintdef(oid) ilike '%tipo_contratacao%' limit 1;
  if cn is not null then execute format('alter table hr.funcionarios drop constraint %I', cn); end if;
end $$;
alter table hr.funcionarios
  add constraint funcionarios_tipo_contratacao_check
  check (tipo_contratacao in ('CLT','PJ','Freela'));

-- 2) Campos novos no cadastro (dossiê + pagamento de freela)
alter table hr.funcionarios
  add column if not exists data_nascimento date,
  add column if not exists foto_url text,
  add column if not exists chave_pix text,
  add column if not exists tipo_chave_pix text,
  add column if not exists valor_diaria numeric;

-- 3) Banco de documentos por funcionário
create table if not exists hr.documentos_funcionario (
  id uuid primary key default gen_random_uuid(),
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  tipo text not null,            -- carteira_trabalho | exame_admissional | contrato | rg_cpf | outro
  descricao text,
  storage_path text not null,    -- caminho no bucket rh-documentos
  nome_arquivo text,
  mime text,
  tamanho_bytes bigint,
  validade date,                 -- p/ exames/contratos que vencem (alimenta alertas v1.5)
  uploaded_by uuid,
  criado_em timestamptz not null default now()
);
create index if not exists idx_doc_func on hr.documentos_funcionario(funcionario_id);

grant select, insert, update, delete on hr.documentos_funcionario to authenticated, service_role;

-- 4) Bucket privado de documentos (acesso só via API com URL assinada)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rh-documentos', 'rh-documentos', false, 15728640,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
