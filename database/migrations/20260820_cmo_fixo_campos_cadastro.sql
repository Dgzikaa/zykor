-- Campos que faltavam pro CMO FIXO sair da planilha (20/08/2026).
--
-- Gonza (19/08, 23h): "no cadastro do funcionário fica: Salário / VT / Adicional / Consumação.
-- Pq o salário tem encargo e o adicional não, saca" — e "vale colocar no cadastro da função
-- também se é cargo de confiança ou não. Que os cargos de confiança não têm escala".
--
-- Por que campos separados e não um "outros" só: INSS, FGTS e provisão incidem sobre o salário.
-- Jogar adicional/consumação lá dentro inflaria os encargos no cálculo do custo-empresa.
--
-- vale_transporte_diaria JÁ EXISTIA na tabela (e no contrato) — só não aparecia na tela.

alter table hr.funcionarios
  add column if not exists adicional_mensal numeric,
  add column if not exists consumacao_mensal numeric;

alter table hr.contratos_funcionario
  add column if not exists adicional_mensal numeric,
  add column if not exists consumacao_mensal numeric;

alter table hr.cargos add column if not exists cargo_confianca boolean not null default false;

-- Semeado a partir do próprio organograma: cargo com cadeira embaixo é chefia. Marcou 17 cargos
-- (Ordinário 7, Deboche 4, Escritório 6). O RH ajusta na tela do cargo (✎ da cadeira) se algum
-- estiver errado — o padrão é só um chute educado, não uma regra.
with chefias as (
  select distinct c.cargo_id from hr.cadeiras c
  where c.ativa and exists (select 1 from hr.cadeiras s where s.cadeira_chefe_id = c.id and s.ativa)
)
update hr.cargos cg set cargo_confianca = true
 from chefias ch where cg.id = ch.cargo_id and cg.cargo_confianca = false;
