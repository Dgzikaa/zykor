-- Três pesquisas, um motor só (20/08/2026, ajustes do Gonza).
--
-- 1) FELICIDADE      — 5 perguntas sorteadas do banco, anônima. Já existia; muda o formato:
--                      sem o nome da dimensão na tela, ordem embaralhada, sem campo aberto
--                      ("opinião aberta a gente pega na Marca Empregadora") e a ÁREA passa a
--                      ser obrigatória onde o bar tem setores separados.
-- 2) MARCA EMPREGADORA — sempre a mesma: "o quanto você recomendaria o {bar} para um amigo
--                      trabalhar?" (0 a 10) + sugestão aberta. 100% anônima, sem área.
-- 3) FEEDBACK        — uma pergunta, perto do dia 15: "o seu líder direto já teve uma conversa
--                      de feedback contigo este mês?". NÃO é anônima: guarda quem respondeu e
--                      quem é o líder, que sai do organograma.
--
-- Um motor só porque as três são "rodada com link + respostas": duplicar tabela por pesquisa
-- significaria duplicar o link público, o fechamento e a apuração três vezes.

alter table hr.pesquisa_rodada
  add column if not exists tipo text not null default 'felicidade';
do $$ begin
  alter table hr.pesquisa_rodada add constraint pesquisa_rodada_tipo_ck
    check (tipo in ('felicidade','marca_empregadora','feedback'));
exception when duplicate_object then null; end $$;

-- Uma rodada por semana valia pra felicidade; com três tipos, a chave passa a incluir o tipo.
drop index if exists hr.uq_pesquisa_rodada_bar_ref;
create unique index if not exists uq_pesquisa_rodada_bar_tipo_ref
  on hr.pesquisa_rodada (bar_id, tipo, referencia);

alter table hr.pesquisa_resposta
  -- só a de FEEDBACK preenche: as outras duas continuam sem nada que identifique a pessoa
  add column if not exists funcionario_id integer references hr.funcionarios(id) on delete set null,
  add column if not exists lider_id integer references hr.funcionarios(id) on delete set null,
  -- marca empregadora: 0 a 10 (eNPS)
  add column if not exists nota smallint check (nota between 0 and 10),
  -- feedback: teve ou não teve a conversa
  add column if not exists sim boolean;

alter table hr.pesquisa_resposta alter column respostas drop not null;

-- Uma resposta por pessoa na rodada identificada. Sem isto, quem abrisse o link duas vezes
-- contaria duas — e a pergunta é justamente "quem já teve a conversa".
create unique index if not exists uq_pesquisa_resposta_pessoa
  on hr.pesquisa_resposta (rodada_id, funcionario_id) where funcionario_id is not null;

-- ---------------------------------------------------------------------------
-- Config por bar. Nasce disto: "a área para o Ordinário é obrigatório e para o Deboche não tem
-- seleção de área, é como se fosse todos em 1 área só".
--
-- Vira CONFIG e não `if (bar_id === 3)` porque bar novo entra sem ninguém lembrar de mexer no
-- código — e porque o dia em que o Deboche crescer e quiser separar por setor é uma linha de
-- UPDATE, não um deploy.
-- ---------------------------------------------------------------------------
create table if not exists hr.pesquisa_config (
  bar_id integer primary key,
  exige_area boolean not null default true,
  atualizado_em timestamptz not null default now()
);
grant select, insert, update on hr.pesquisa_config to service_role;

insert into hr.pesquisa_config (bar_id, exige_area) values (3, true), (4, false)
on conflict (bar_id) do update set exige_area = excluded.exige_area, atualizado_em = now();
