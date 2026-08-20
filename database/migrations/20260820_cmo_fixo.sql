-- CMO FIXO: a folha do mês sai da planilha e passa a viver no Zykor (20/08/2026).
--
-- Gonza: "to pensando se vamos pro cálculo do CMO fixo já... que é substituir essa planilha
-- aqui. E puxando já automaticamente os funcionários pelo organograma. E por enquanto o input
-- manual de quantos dias a pessoa trabalhou, que logo em seguida vamos puxar lá da confirmação
-- da escala. Ai o único input é a coluna AB, pq o restante tudo já vai puxar do organograma."
--
-- Não é do zero: /api/rh/folha-pagamento e hr.folha_pagamento já existiam com as fórmulas da
-- planilha — mas mortos (só jan/fev de 2026, 57 linhas idênticas, geradas com 30 dias fixos e
-- intocadas desde 08/02). O cálculo velho também divergia: base de provisão errada (usava 27%
-- da base COM estimativa) e o custo-empresa nem somava o salário.
--
-- Agora o cálculo vive em frontend/src/lib/rh/folha.ts, conferido linha a linha contra a
-- planilha (Lucia, Nayara, Dudu e Andreia — diferença máxima de 1 centavo).
--
-- Campos novos: estimativa e tempo de casa são MANUAIS por pessoa (o Gonza confirmou), então
-- moram no cadastro, não no fechamento — mudam quando o RH decide, não todo mês.

alter table hr.funcionarios
  add column if not exists estimativa_mensal numeric,
  add column if not exists tempo_casa_mensal numeric;

alter table hr.contratos_funcionario
  add column if not exists estimativa_mensal numeric,
  add column if not exists tempo_casa_mensal numeric;

-- consumacao: não existe na planilha, o Gonza pediu. dias_mes/dias_vt: a planilha rateia por
-- dia de calendário (31) mas paga VT por dia trabalhado (22) — são dois números diferentes e
-- guardar só um obrigaria a adivinhar depois. fechado: mês fechado não muda mais.
alter table hr.folha_pagamento
  add column if not exists consumacao numeric,
  add column if not exists dias_mes integer,
  add column if not exists dias_vt integer,
  add column if not exists fechado boolean not null default false;

-- O adicional noturno morava nas áreas ANTIGAS (Salão 125, Bar 125, Cozinha 115). Depois que o
-- cadastro passou a espelhar o organograma ninguém está mais em "Salão", então o cálculo daria
-- ZERO de adicional noturno pra casa inteira. Valores transcritos da planilha.
update hr.areas set adicional_noturno = 125
 where bar_id in (3,4) and nome in ('Atendimento','Cumins','Fila','Limpeza/Infra','Bar');
update hr.areas set adicional_noturno = 115
 where bar_id in (3,4) and nome = 'Cozinha';
-- Quem é cargo de confiança não recebe adicional noturno — é o que a planilha faz deixando a
-- área "Liderança" em 0, e agora sai do flag do cargo em vez de depender da área da pessoa.
