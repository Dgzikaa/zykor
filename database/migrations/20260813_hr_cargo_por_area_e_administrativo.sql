-- Cargo pertence a uma ÁREA + organograma administrativo semeado (ata de 13/08/2026)
--
-- "os cargos tem que ser de acordo com a área ex: administrativo, qnd selecionado, filtraria os
-- cargos pra aparecer: diretor administrativo, analista financeiro, auxiliar financeiro..."
-- "vamo alterar pra seguir o modelo que te falei... já cadastrar os sócios... n precisaria criar
-- cadeira pro sócio aparecer ali. e exclui as categorias e áreas que nao usam, só as que foram
-- faladas."
--
-- ⚠️ O cadastro de áreas estava duplicado: existiam "ASG" e "ASG Ordinário", "Bar" e "Bar Ordinário"
-- etc. As curtas são as que os FUNCIONÁRIOS usam; as com sufixo do bar são as que as ESCALAS usam
-- (milhares de linhas). Por isso nada é apagado — só desativado: apagar quebraria o histórico da
-- escala, e a inativa some dos seletores mas continua resolvendo o nome no que já existe.
--
-- Áreas que sobraram ativas: Atendimento, Bar, Cozinha, Cumins, Fila, Limpeza/Infra (operação) +
-- Administrativo, Marketing, Comercial, Tecnologia, Operações (escritório).
-- Garçons virou Atendimento, Recepção virou Fila e ASG virou Limpeza/Infra (mesmo id, só o rótulo).

alter table hr.cargos add column if not exists area_id integer references hr.areas(id);

comment on column hr.cargos.area_id is
  'Área a que o cargo pertence; NULO = aparece em qualquer área (sócio, freela, gerência).';

-- Legado sem nenhum uso que ocupava os nomes novos (0 funcionários e 0 escalas).
-- Renomeado em vez de apagado, para preservar o id caso algo antigo aponte para ele.
update hr.areas set nome = nome || ' (legado)', ativo = false where id in (5, 7, 12);

update hr.areas set nome = 'Atendimento'   where id in (31, 33);
update hr.areas set nome = 'Fila'          where id = 30;
update hr.areas set nome = 'Limpeza/Infra' where id in (28, 27);

insert into hr.areas (bar_id, nome, ativo)
select 3, v.nome, true from (values
  ('Administrativo'), ('Marketing'), ('Comercial'), ('Tecnologia'), ('Operações')
) v(nome)
where not exists (select 1 from hr.areas a where a.bar_id = 3 and lower(a.nome) = lower(v.nome));

insert into hr.cargos (bar_id, nome, area_id, ativo)
select 3, c.nome, a.id, true
from (values
  ('Diretor Administrativo','Administrativo'), ('Analista Financeiro','Administrativo'),
  ('Auxiliar Financeiro','Administrativo'),    ('Analista RH/DP','Administrativo'),
  ('Estagiária RH/DP','Administrativo'),       ('Analista de Produção','Administrativo'),
  ('Coordenador de Marketing','Marketing'),    ('Gestor de Comunidade','Marketing'),
  ('Trainee','Marketing'),                     ('Design Pleno','Marketing'),
  ('Design Júnior','Marketing'),               ('Social Mídia','Marketing')
) c(nome, area)
join hr.areas a on a.bar_id = 3 and lower(a.nome) = lower(c.area)
where not exists (select 1 from hr.cargos x where x.bar_id = 3 and lower(x.nome) = lower(c.nome));

-- Sócio executivo: a área varia por sócio (Marketing, Administrativo, Operações, Comercial,
-- Tecnologia), então o cargo fica SEM área para aparecer em todas.
insert into hr.cargos (bar_id, nome, ativo)
select b.bar_id, 'Sócio Executivo', true from (values (3), (4)) b(bar_id)
where not exists (select 1 from hr.cargos x where x.bar_id = b.bar_id and lower(x.nome) = 'sócio executivo');

update hr.cargos c set area_id = a.id
from hr.areas a
where a.bar_id = c.bar_id and c.area_id is null and (
     (lower(c.nome) in ('garçom','garcom','chefe de atendimento')              and a.nome = 'Atendimento')
  or (lower(c.nome) in ('barback','bartender','chefe de bar')                  and a.nome = 'Bar')
  or (lower(c.nome) in ('auxiliar de cozinha','cozinheiro','chefe de cozinha') and a.nome = 'Cozinha')
  or (lower(c.nome) in ('cumin','cumim','chefe de cumins')                     and a.nome = 'Cumins')
  or (lower(c.nome) in ('recepcionista','chefe de fila','hostess')             and a.nome = 'Fila')
  or (lower(c.nome) in ('auxiliar de serviços gerais','auxiliar de limpeza','chefe de limpeza/infra') and a.nome = 'Limpeza/Infra')
  or (lower(c.nome) in ('assistente de produção','auxiliar de produção')       and a.nome = 'Administrativo')
);

-- Produção é administrativo: leva Diego Galdino e Natália Dias para a área nova.
update hr.funcionarios f set area_id = (select id from hr.areas where bar_id=3 and nome='Administrativo')
where f.bar_id = 3 and f.ativo
  and f.area_id in (select id from hr.areas where bar_id=3 and nome = 'Produção');

update hr.areas set ativo = false
where nome not in ('Atendimento','Bar','Cozinha','Cumins','Fila','Limpeza/Infra',
                   'Administrativo','Marketing','Comercial','Tecnologia','Operações');

-- Cargo fora da lista só é desativado se NINGUÉM ativo estiver usando — senão sobraria gente com
-- cargo inativo, que some dos seletores e vira um buraco no cadastro.
update hr.cargos c set ativo = false
where c.ativo
  and lower(c.nome) not in (
    'garçom','barback','bartender','auxiliar de cozinha','cozinheiro','cumin','recepcionista',
    'auxiliar de serviços gerais','gerente operacional','sócio executivo',
    'chefe de atendimento','chefe de fila','chefe de limpeza/infra','chefe de bar','chefe de cumins','chefe de cozinha',
    'diretor administrativo','analista financeiro','auxiliar financeiro','analista rh/dp','estagiária rh/dp',
    'analista de produção','assistente de produção','auxiliar de produção',
    'coordenador de marketing','gestor de comunidade','trainee','design pleno','design júnior','social mídia'
  )
  and not exists (select 1 from hr.funcionarios f where f.cargo_id = c.id and f.ativo);

-- A estrutura administrativa em si (sócios com nome digitado + uma cadeira por cargo) foi semeada
-- pela migration hr_seed_organograma_administrativo, aplicada na sequência.
