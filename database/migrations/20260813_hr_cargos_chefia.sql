-- Cargos de chefia que a estrutura da operação usa e não existiam no cadastro.
--
-- Ata de 13/08/2026: gerente operacional no topo e seis chefias abaixo — atendimento, fila,
-- limpeza/infra, bar, cumins e cozinha. Sem o cargo cadastrado não havia como marcar no colaborador
-- quem é o chefe de cumins, de atendimento etc. (o dono pegou isso testando a tela).
--
-- Gerente Operacional, Chefe de Cozinha e Chefe de Salão já existiam.
--
-- ⚠️ Pendência de cadastro, não resolvida aqui: o Ordinário tem os cargos "Cumim" E "Cumin", que são
-- a mesma coisa. Unificar exige decidir qual fica e remapear as pessoas — trabalho do RH.
insert into hr.cargos (bar_id, nome, ativo)
select b.bar_id, c.nome, true
from (values (3), (4)) as b(bar_id)
cross join (values
  ('Chefe de Atendimento'),
  ('Chefe de Fila'),
  ('Chefe de Limpeza/Infra'),
  ('Chefe de Bar'),
  ('Chefe de Cumins')
) as c(nome)
where not exists (
  select 1 from hr.cargos x
  where x.bar_id = b.bar_id and lower(x.nome) = lower(c.nome)
);
