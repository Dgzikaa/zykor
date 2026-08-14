-- Calibração trimestral completa, no formato do card que o RH já usa (docs/avaliação.jpg)
--
-- A tabela existia com dois eixos e um campo de observação. O card real tem oito blocos: última
-- calibração, auto-avaliação, advertências, NPS, fit cultural, atributos de performance POR CARGO,
-- avaliação final e missões do trimestre — além dos dois textões.
--
-- ESCALA: 5 níveis. O dono tinha falado em 4 (insatisfatório/abaixo/atende/destaque), mas o card da
-- Ana Clara traz ACIMA DAS EXPECTATIVAS nos dois eixos — sem esse nível a calibração dela não seria
-- representável. Confirmado com ele antes de trocar.
-- A tabela está VAZIA (0 linhas), então trocar a escala não custou migração de dado.

alter table hr.calibracoes
  add column if not exists auto_comportamento text,
  add column if not exists auto_performance text,
  add column if not exists texto_comportamental text,
  add column if not exists texto_performance text,
  add column if not exists missoes text[] not null default '{}',
  add column if not exists nps_entrega numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calibracao_nivel_valido') then
    alter table hr.calibracoes add constraint calibracao_nivel_valido check (
      coalesce(comportamento, 'atende') in ('insatisfatorio','abaixo','atende','acima','destaque')
      and coalesce(performance, 'atende') in ('insatisfatorio','abaixo','atende','acima','destaque')
      and coalesce(auto_comportamento, 'atende') in ('insatisfatorio','abaixo','atende','acima','destaque')
      and coalesce(auto_performance, 'atende') in ('insatisfatorio','abaixo','atende','acima','destaque')
    );
  end if;
end $$;

comment on column hr.calibracoes.missoes is 'Missões do trimestre (o card mostra 3, mas não há limite).';
comment on column hr.calibracoes.nps_entrega is 'NPS da pessoa no trimestre, congelado no momento da calibração.';

-- Fit cultural: os valores da casa, iguais para todo mundo.
create table if not exists hr.fit_cultural_valores (
  id serial primary key,
  bar_id integer not null,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  unique (bar_id, nome)
);

create table if not exists hr.calibracao_fit (
  calibracao_id uuid not null references hr.calibracoes(id) on delete cascade,
  valor_id integer not null references hr.fit_cultural_valores(id) on delete cascade,
  nota text not null check (nota in ('+', '+/-', '-')),
  primary key (calibracao_id, valor_id)
);

-- Atributos de performance são POR CARGO: o que se cobra de um barback não é o que se cobra de um
-- garçom. No card da Ana aparecem os do "Barback - Soft".
create table if not exists hr.cargo_atributos (
  id serial primary key,
  bar_id integer not null,
  cargo_id integer not null references hr.cargos(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  unique (cargo_id, nome)
);

create table if not exists hr.calibracao_atributo (
  calibracao_id uuid not null references hr.calibracoes(id) on delete cascade,
  atributo_id integer not null references hr.cargo_atributos(id) on delete cascade,
  nivel text not null check (nivel in ('insatisfatorio','abaixo','atende','acima','destaque')),
  primary key (calibracao_id, atributo_id)
);

comment on table hr.fit_cultural_valores is 'Valores da casa avaliados na calibração (+ / +/- / -).';
comment on table hr.cargo_atributos is 'Atributos de performance específicos de cada cargo.';

grant select, insert, update, delete on hr.fit_cultural_valores to service_role;
grant select, insert, update, delete on hr.calibracao_fit to service_role;
grant select, insert, update, delete on hr.cargo_atributos to service_role;
grant select, insert, update, delete on hr.calibracao_atributo to service_role;
grant usage, select on sequence hr.fit_cultural_valores_id_seq to service_role;
grant usage, select on sequence hr.cargo_atributos_id_seq to service_role;

insert into hr.fit_cultural_valores (bar_id, nome, ordem)
select b.bar_id, v.nome, v.ord
from (values (3), (4)) b(bar_id)
cross join (values
  ('Leal a Empresa', 1),
  ('Resolve o Problema', 2),
  ('Nem cuzão, nem bundão', 3),
  ('Come dado com farofa', 4),
  ('Curte o caminho', 5),
  ('Missão dada é missão cumprida', 6),
  ('Errar faz parte. Não aprender, não', 7)
) v(nome, ord)
where not exists (
  select 1 from hr.fit_cultural_valores x where x.bar_id = b.bar_id and x.nome = v.nome
);

-- Atributos do Barback, os únicos que o card revela. Os demais cargos o RH preenche.
insert into hr.cargo_atributos (bar_id, cargo_id, nome, ordem)
select c.bar_id, c.id, a.nome, a.ord
from hr.cargos c
cross join (values
  ('Precisão (não errar)', 1),
  ('Conhecimento de Produção de Xaropes', 2),
  ('Organização', 3),
  ('Percepção de Prioridades', 4),
  ('Velocidade', 5),
  ('Capacidade de seguir processos', 6),
  ('Especialidade', 7)
) a(nome, ord)
where lower(c.nome) = 'barback'
  and not exists (select 1 from hr.cargo_atributos x where x.cargo_id = c.id and x.nome = a.nome);
