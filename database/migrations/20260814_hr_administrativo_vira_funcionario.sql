-- Organograma administrativo: o ocupante vira funcionário de verdade.
--
-- Bug relatado pelo dono em 14/08/2026: "n ta dando pra clicar no funcionario e ver o perfil
-- igual os outros, tava vendo o da thais dias por ex, ta errado como diretor administrativo e
-- n da pra abrir pra editar o funcionario".
--
-- Duas causas distintas:
--
-- 1) A cadeira COORDENADOR RH/DP apontava para o cargo "Diretor Administrativo" — o cargo
--    "Coordenador RH/DP" simplesmente não existia. Por isso a Thaís aparecia como diretora.
--
-- 2) As cadeiras do administrativo guardavam só `ocupante_nome` (texto). Nenhuma dessas pessoas
--    existia em hr.funcionarios, então não havia dossiê pra abrir — o card era mudo de propósito,
--    mas na tela isso parece clique quebrado. Como a ata pediu para unificar organograma e
--    equipe, elas passam a ser funcionários e a cadeira passa a ter ocupação de verdade.
--
-- Os SÓCIOS continuam como texto: não são folha do bar. O card deles mostra "sem ficha".
--
-- Já aplicada no banco em 14/08/2026 (bar 3).

-- 1) cargo que faltava
insert into hr.cargos (bar_id, nome, area_id, ativo)
select 3, 'Coordenador RH/DP', 39, true
where not exists (select 1 from hr.cargos where bar_id = 3 and upper(nome) = 'COORDENADOR RH/DP');

update hr.cadeiras
set cargo_id = (select id from hr.cargos where bar_id = 3 and upper(nome) = 'COORDENADOR RH/DP'),
    area_id = 39,
    atualizado_em = now()
where bar_id = 3 and codigo = 'COORDENADOR RH/DP';

-- 2) cada nome digitado no administrativo (menos sócio) vira funcionário e ocupa a cadeira
with alvo as (
  select c.id as cadeira_id, btrim(c.ocupante_nome) as nome, c.cargo_id, c.area_id
  from hr.cadeiras c
  where c.bar_id = 3 and c.ativa and c.escopo = 'administrativo'
    and coalesce(btrim(c.ocupante_nome), '') <> ''
    and c.codigo not like 'SÓCIO%'
    and not exists (select 1 from hr.cadeira_ocupacao o where o.cadeira_id = c.id and o.fim is null)
), novo as (
  insert into hr.funcionarios (bar_id, nome, cargo_id, area_id, ativo, tipo_contratacao)
  select 3, upper(a.nome), a.cargo_id, a.area_id, true, 'CLT' from alvo a
  returning id, nome
)
insert into hr.cadeira_ocupacao (cadeira_id, funcionario_id, inicio)
select a.cadeira_id, n.id, current_date
from alvo a join novo n on n.nome = upper(a.nome);

-- o nome agora vive no funcionário; manter o texto faria a cadeira mostrar dois donos
update hr.cadeiras c
set ocupante_nome = null, atualizado_em = now()
where c.bar_id = 3 and c.escopo = 'administrativo' and c.codigo not like 'SÓCIO%'
  and exists (select 1 from hr.cadeira_ocupacao o where o.cadeira_id = c.id and o.fim is null);
