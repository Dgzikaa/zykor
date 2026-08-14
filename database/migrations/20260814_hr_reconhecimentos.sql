-- Reconhecimentos (ata de RH de 13/08/2026)
--
-- "PESQUISAS ... ABA DE RECONHECIMENTOS."
--
-- Tabela separada de `hr.funcionario_ocorrencias` DE PROPÓSITO: ocorrência é o lado
-- disciplinar — vira alerta no dossiê e conta cartão na súmula. Reconhecimento é o oposto e
-- não pode entrar na mesma contagem, senão elogiar alguém pioraria o painel dessa pessoa.
--
-- Já aplicada no banco em 14/08/2026; este arquivo é a versão no repositório.

create table if not exists hr.reconhecimentos (
  id               uuid primary key default gen_random_uuid(),
  bar_id           integer not null references public.bars(id),
  funcionario_id   integer not null references hr.funcionarios(id) on delete cascade,
  data             date not null default current_date,
  titulo           text not null,
  descricao        text,
  -- quem reconheceu (o líder/colega); texto livre porque pode vir de cliente ou de fora do cadastro
  reconhecido_por  text,
  -- quem digitou no Zykor — para a trilha
  registrado_por   text,
  criado_em        timestamptz not null default now()
);

create index if not exists idx_hr_reconhecimentos_bar_data
  on hr.reconhecimentos (bar_id, data desc);
create index if not exists idx_hr_reconhecimentos_funcionario
  on hr.reconhecimentos (funcionario_id, data desc);

comment on table hr.reconhecimentos is
  'Reconhecimentos/elogios. Separado de funcionario_ocorrencias para não contaminar a contagem disciplinar (cartões/súmula).';
