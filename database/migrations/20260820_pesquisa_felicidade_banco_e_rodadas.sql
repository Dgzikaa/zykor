-- Pesquisa da Felicidade: o Zykor vira o formulário (20/08/2026).
--
-- Gonza: "seria o Zykor gerar um link da pesquisa pra galera preencher, como se fosse um forms.
-- Mas ele já gerar automaticamente as perguntas do formulário, que vão variando, puxando do
-- banco de perguntas. São 5 perguntas, uma de cada dimensão... e o Zykor puxa desse banco 1
-- pergunta de cada dimensão e forma o forms pra galera responder. E aí manda esse forms no wpp".
--
-- BANCO: 55 perguntas (11 × 5 dimensões), extraídas da planilha "Perguntas Pesquisa de
-- Felicidade" que o Rodrigo colocou em docs/. Duas perguntas apareciam em duas redações ao
-- longo dos ciclos ("família Deboche"/"time Deboche" e equipe "coesa"/"unida") — ficou a mais
-- recente, senão o sorteio poderia mandar a mesma pergunta duas vezes com palavras diferentes.
--
-- O NOME DO BAR é um marcador `{bar}`, não texto fixo: "Tenho orgulho de trabalhar no {bar}"
-- vira Ordinário ou Deboche na hora de montar a rodada. Era o pedido explícito do Gonza.
--
-- ANONIMATO: a resposta NÃO guarda quem respondeu. Guarda a área (opcional), porque é assim que
-- o indicador é lido hoje — agregado por setor. Nenhuma coluna liga resposta a funcionário.
--
-- Cuidado herdado: em 13/08/2026 a rota pública /api/pesquisa-felicidade foi REMOVIDA por ser
-- pública E gravar direto no indicador. Aqui a rota pública grava em tabela PRÓPRIA de
-- respostas, só com token de rodada aberta, e não devolve resultado nenhum.

create table if not exists hr.pesquisa_pergunta (
  id serial primary key,
  -- NULL = vale pra todos os bares. Bar específico pode cadastrar pergunta só dele depois.
  bar_id integer,
  dimensao text not null check (dimensao in
    ('engajamento','pertencimento','relacionamento','gestor','reconhecimento')),
  ordem integer not null,
  texto text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists uq_pesquisa_pergunta on hr.pesquisa_pergunta (coalesce(bar_id, 0), dimensao, ordem);

create table if not exists hr.pesquisa_rodada (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  -- token do link público. Longo de propósito: é a única credencial da rodada.
  token text not null unique,
  referencia date not null,
  aberta boolean not null default true,
  criada_em timestamptz not null default now(),
  criada_por text,
  fechada_em timestamptz
);
create index if not exists idx_pesquisa_rodada_bar on hr.pesquisa_rodada (bar_id, referencia desc);

create table if not exists hr.pesquisa_rodada_pergunta (
  rodada_id uuid not null references hr.pesquisa_rodada(id) on delete cascade,
  dimensao text not null,
  ordem integer not null,
  pergunta_id integer references hr.pesquisa_pergunta(id),
  -- texto JÁ com o nome do bar aplicado: a rodada tem que continuar legível mesmo que a
  -- pergunta do banco seja editada depois.
  texto text not null,
  primary key (rodada_id, dimensao)
);

create table if not exists hr.pesquisa_resposta (
  id uuid primary key default gen_random_uuid(),
  rodada_id uuid not null references hr.pesquisa_rodada(id) on delete cascade,
  bar_id integer not null,
  area_id integer,
  -- { engajamento: 1..5, pertencimento: 1..5, ... }
  respostas jsonb not null,
  comentario text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_pesquisa_resposta_rodada on hr.pesquisa_resposta (rodada_id);

grant select, insert, update, delete on hr.pesquisa_pergunta, hr.pesquisa_rodada,
  hr.pesquisa_rodada_pergunta, hr.pesquisa_resposta to service_role;
grant usage, select on sequence hr.pesquisa_pergunta_id_seq to service_role;

insert into hr.pesquisa_pergunta (dimensao, ordem, texto) values
  ('engajamento', 1, 'Hoje eu estou feliz no meu trabalho'),
  ('engajamento', 2, 'Eu sou capaz de equilibrar meu trabalho e vida pessoal'),
  ('engajamento', 3, 'Me sinto bem quando tenho de acordar para ir trabalhar'),
  ('engajamento', 4, 'Eu sinto orgulho do meu cargo dentro da empresa'),
  ('engajamento', 5, 'Os níveis de estresse no trabalho são administráveis'),
  ('engajamento', 6, 'Sinto-me motivado e energizado para contribuir com o meu melhor no trabalho'),
  ('engajamento', 7, 'Estou entusiasmado com os projetos e desafios que enfrento diariamente'),
  ('engajamento', 8, 'Estou ansioso para aprender e crescer profissionalmente'),
  ('engajamento', 9, 'Sinto-me comprometido em alcançar os objetivos e metas da empresa'),
  ('engajamento', 10, 'Estou animado para esta semana de trabalho'),
  ('engajamento', 11, 'Estou engajado em crescer na minha carreira'),
  ('pertencimento', 1, 'Estou satisfeito com os benefícios atuais que a empresa oferece'),
  ('pertencimento', 2, 'Tenho orgulho de trabalhar no {bar}'),
  ('pertencimento', 3, 'Pretendo continuar no {bar} pelos próximos 12 meses'),
  ('pertencimento', 4, 'Eu tenho uma compreensão clara das metas e objetivos do {bar}'),
  ('pertencimento', 5, 'No {bar} as mudanças são informadas aos colaboradores'),
  ('pertencimento', 6, 'Tenho oportunidades de desenvolvimento profissional dentro da empresa'),
  ('pertencimento', 7, 'Sinto que a empresa se preocupa com o meu bem-estar físico e mental'),
  ('pertencimento', 8, 'Sinto que meu trabalho tem um impacto tangível nos resultados da empresa'),
  ('pertencimento', 9, 'Estou investido no futuro do {bar} e quero continuar nessa jornada'),
  ('pertencimento', 10, 'Estou emocionalmente ligado à marca e à reputação do {bar}'),
  ('pertencimento', 11, 'Sinto-me privilegiado por fazer parte do time {bar}'),
  ('relacionamento', 1, 'Me sinto conectado com meus colegas de trabalho'),
  ('relacionamento', 2, 'Sinto que faço parte de um time'),
  ('relacionamento', 3, 'No {bar} as pessoas se respeitam'),
  ('relacionamento', 4, 'Nossa equipe trabalha bem em conjunto para alcançar objetivos comuns'),
  ('relacionamento', 5, 'Sinto que tenho um bom relacionamento com meus colegas de trabalho'),
  ('relacionamento', 6, 'Sinto-me parte de uma equipe que se apoia mutuamente nos momentos de desafio'),
  ('relacionamento', 7, 'Tenho um forte senso de camaradagem com meus colegas de equipe'),
  ('relacionamento', 8, 'Tenho uma conexão genuína com meus colegas de equipe'),
  ('relacionamento', 9, 'Estou em um ambiente de trabalho onde as relações entre colegas são de respeito e confiança'),
  ('relacionamento', 10, 'Tenho um bom clima de trabalho com meus colegas'),
  ('relacionamento', 11, 'Nossa equipe é unida e trabalha para o bem comum da empresa'),
  ('gestor', 1, 'Confio nos meus superiores'),
  ('gestor', 2, 'Meus superiores valorizam minha opinião'),
  ('gestor', 3, 'Meus superiores me orientam e me aconselham'),
  ('gestor', 4, 'Meu superior me fornece feedback claro e regular'),
  ('gestor', 5, 'Meus superiores valorizam as minhas sugestões'),
  ('gestor', 6, 'Tenho confiança na liderança da empresa'),
  ('gestor', 7, 'Sinto que recebo orientação e suporte adequados dos meus superiores para realizar meu trabalho'),
  ('gestor', 8, 'Tenho um relacionamento aberto e transparente com meus superiores'),
  ('gestor', 9, 'Tenho um relacionamento de trabalho positivo e produtivo com meus superiores'),
  ('gestor', 10, 'Tenho plena confiança na capacidade e nas decisões dos meus superiores'),
  ('gestor', 11, 'Eu me dou bem com meus superiores'),
  ('reconhecimento', 1, 'A empresa oferece oportunidades adequadas para promoções e plano de carreira'),
  ('reconhecimento', 2, 'Acredito que meu desempenho é avaliado de forma justa'),
  ('reconhecimento', 3, 'A empresa reconhece e recompensa regularmente o desempenho excelente'),
  ('reconhecimento', 4, 'Me sinto valorizado como colaborador do {bar}'),
  ('reconhecimento', 5, 'Eu me sinto tratado de forma justa em relação a recompensas e reconhecimento'),
  ('reconhecimento', 6, 'Sinto que sou reconhecido pelo meu trabalho dentro da empresa quando faço por merecer'),
  ('reconhecimento', 7, 'Recebo feedback construtivo sobre o meu desempenho regularmente'),
  ('reconhecimento', 8, 'Sinto que as recompensas e reconhecimentos na empresa são distribuídos de maneira justa'),
  ('reconhecimento', 9, 'Os reconhecimentos vão para as pessoas que realmente desempenham trabalho acima da média'),
  ('reconhecimento', 10, 'Quando eu me destaco acima da média sou reconhecido'),
  ('reconhecimento', 11, 'Eu sei o que preciso fazer para ser reconhecido ou promovido')
on conflict do nothing;
