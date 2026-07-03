-- Pesquisas de uso do sistema (feedback dos usuários).
-- Aplicada no banco em 2026-07-03 via MCP. Mantida aqui p/ versionamento.
--
-- Modelo:
--   feedback.pesquisas        — definição da pesquisa (permite rodar várias)
--   feedback.pesquisa_itens   — perguntas (nota_1_10 | texto), editáveis como dado
--   feedback.respostas        — controle 1x-por-usuário (status + adiamento até 3x)
--   feedback.respostas_itens  — respostas item a item

create schema if not exists feedback;
grant usage on schema feedback to service_role;

create table if not exists feedback.pesquisas (
  id bigint generated always as identity primary key,
  slug text unique not null,
  titulo text not null,
  subtitulo text,
  ativa boolean not null default true,
  versao int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists feedback.pesquisa_itens (
  id bigint generated always as identity primary key,
  pesquisa_id bigint not null references feedback.pesquisas(id) on delete cascade,
  ordem int not null,
  chave text not null,
  tipo text not null check (tipo in ('nota_1_10','texto')),
  titulo text not null,
  obrigatoria boolean not null default false,
  unique (pesquisa_id, chave)
);

create table if not exists feedback.respostas (
  id bigint generated always as identity primary key,
  pesquisa_id bigint not null references feedback.pesquisas(id) on delete cascade,
  usuario_id uuid,
  email text not null,
  bar_id int,
  status text not null default 'pendente' check (status in ('pendente','adiada','dispensada','respondida')),
  tentativas int not null default 0,
  adiar_ate timestamptz,
  respondida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pesquisa_id, email)
);

create table if not exists feedback.respostas_itens (
  id bigint generated always as identity primary key,
  resposta_id bigint not null references feedback.respostas(id) on delete cascade,
  item_chave text not null,
  nota int check (nota between 1 and 10),
  texto text
);

create index if not exists idx_respostas_pesquisa_status on feedback.respostas(pesquisa_id, status);
create index if not exists idx_respostas_itens_resposta on feedback.respostas_itens(resposta_id);

alter table feedback.pesquisas enable row level security;
alter table feedback.pesquisa_itens enable row level security;
alter table feedback.respostas enable row level security;
alter table feedback.respostas_itens enable row level security;

grant all on all tables in schema feedback to service_role;
grant all on all sequences in schema feedback to service_role;
alter default privileges in schema feedback grant all on tables to service_role;
alter default privileges in schema feedback grant all on sequences to service_role;

-- Seed: 1ª pesquisa (primeira impressão)
insert into feedback.pesquisas (slug, titulo, subtitulo)
values (
  'primeira-impressao-2026',
  'E aí, o que você tá achando do Zykor? 👀',
  'Leva menos de 1 minuto. Tua opinião ajuda demais a melhorar o sistema. 🙏'
)
on conflict (slug) do nothing;

insert into feedback.pesquisa_itens (pesquisa_id, ordem, chave, tipo, titulo, obrigatoria)
select p.id, v.ordem, v.chave, v.tipo, v.titulo, v.obrigatoria
from feedback.pesquisas p
cross join (values
  (1, 'facilidade', 'nota_1_10', 'É fácil de mexer? 🧭', false),
  (2, 'utilidade',  'nota_1_10', 'Te ajuda no dia a dia? 💪', false),
  (3, 'velocidade', 'nota_1_10', 'Velocidade e desempenho ⚡', false),
  (4, 'visual',     'nota_1_10', 'Visual e organização 🎨', false),
  (5, 'confianca',  'nota_1_10', 'Confiança nos números 📊', false),
  (6, 'geral',      'nota_1_10', 'Nota geral pro Zykor ⭐', true),
  (7, 'comentario', 'texto',     'Manda ver: sugestões, dificuldades, reclamações ✍️', false)
) as v(ordem, chave, tipo, titulo, obrigatoria)
where p.slug = 'primeira-impressao-2026'
on conflict (pesquisa_id, chave) do nothing;

-- Exposição no PostgREST (anexar 'feedback' à lista existente) + reload:
--   alter role authenticator set pgrst.db_schemas = '...existentes...,feedback';
--   notify pgrst, 'reload config';
--   notify pgrst, 'reload schema';
