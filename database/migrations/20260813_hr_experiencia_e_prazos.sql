-- Período de experiência e prazo no onboarding
--
-- Ata de 13/08/2026:
--  · "ao contratar 1 pessoa nova: automaticamente preenche o prazo de período de experiência que é
--    60 dias, ai ja deixa salvo... qnd tiver proximo dos 60 dias, tipo faltando 15 dias começa a ir
--    pro alerta". É o bloco "Datas próximas de finalizar período de experiência" da mensagem de
--    segunda (ex.: Bruna 21/08, Rubi 30/08).
--  · "adicionar: prazo pra receber, em tese 15 dias da data de admissão o treinamento de integração"
--    — o bloco "Onboard (fazer até)".
--  · "tanto em onboarding quanto documentos: termo de recebimento de uniforme".

alter table hr.funcionarios add column if not exists data_fim_experiencia date;

comment on column hr.funcionarios.data_fim_experiencia is
  'Fim do periodo de experiencia (padrao: admissao + 60 dias). Alerta quando falta <= 15 dias.';

-- Preenche o que ja existe. Quem entrou ha muito tempo fica com data no passado e simplesmente
-- nao alerta (o alerta so olha os proximos 15 dias) — melhor isso do que deixar a coluna vazia e
-- ter que lembrar de preencher pessoa a pessoa.
update hr.funcionarios
   set data_fim_experiencia = data_admissao + 60
 where data_fim_experiencia is null and data_admissao is not null;

alter table hr.onboarding_itens add column if not exists prazo date;

comment on column hr.onboarding_itens.prazo is
  'Ate quando o item tem que estar feito. Integracao = admissao + 15 dias.';

-- Prazo do treinamento de integração para quem já tem o checklist semeado.
update hr.onboarding_itens o
   set prazo = f.data_admissao + 15
  from hr.funcionarios f
 where f.id = o.funcionario_id
   and o.prazo is null
   and f.data_admissao is not null
   and o.item ilike '%integra%';

-- Item novo do uniforme para quem já tem checklist (o padrão do código cobre os próximos).
-- "Uniforme entregue" já existe e é outra coisa: aqui é o TERMO assinado.
insert into hr.onboarding_itens (bar_id, funcionario_id, item, ordem)
select o.bar_id, o.funcionario_id, 'Termo de recebimento de uniforme', 8
from (select distinct bar_id, funcionario_id from hr.onboarding_itens) o
where not exists (
  select 1 from hr.onboarding_itens x
  where x.funcionario_id = o.funcionario_id and x.item ilike '%termo%uniforme%'
);
