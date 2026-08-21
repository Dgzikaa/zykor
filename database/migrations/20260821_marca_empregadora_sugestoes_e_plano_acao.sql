-- Marca Empregadora: o que a equipe pediu e o que a liderança vai fazer (21/08/2026, Rodrigo).
--
-- "a gente solta a pesquisa de marca empregadora perguntando se eles têm sugestões (...) a equipe
--  responde um monte de coisa (...) aí o nosso RH compila as principais reclamações e sugestões
--  (...) aí o RH senta com as lideranças para montar os planos de ação (...) eu queria que ficasse
--  registrado esses planos de ação para no mês que vem, quando a gente fosse lançar a pesquisa de
--  novo, a gente revisitar e ver como é que rodou o plano da rodada anterior."
--
-- Fica NA RODADA, não numa tabela solta de "planos": o valor da coisa é justamente ler mês contra
-- mês — "o que pediram em julho / o que prometemos / o que pediram em agosto". Tabela separada
-- exigiria juntar de volta pela referência toda vez, e permitiria plano órfão de pesquisa.
--
-- Texto livre de propósito. O RH já compila as sugestões na mão (é ele que lê as 40 respostas e
-- vira 3 temas); item estruturado com status/responsável seria um mini-Jira que ninguém preenche.

alter table hr.pesquisa_rodada
  -- as principais reivindicações, já compiladas pelo RH a partir das respostas abertas
  add column if not exists sugestoes_equipe text,
  -- o que a liderança combinou de fazer sobre elas
  add column if not exists plano_acao text,
  add column if not exists analise_por text,
  add column if not exists analise_em timestamptz;

comment on column hr.pesquisa_rodada.sugestoes_equipe is
  'Principais sugestões da equipe naquela rodada, compiladas pelo RH a partir dos comentários abertos.';
comment on column hr.pesquisa_rodada.plano_acao is
  'Plano de ação combinado entre RH e liderança para as sugestões daquela rodada. Revisitado na rodada seguinte.';
