-- Organograma por CADEIRA (headcount), não por nome de pessoa
--
-- Ata de 13/08/2026: "NÃO VINCULAR NOME DE FUNCIONÁRIO A OUTRO NOME DE FUNCIONÁRIO... TEM QUE SER
-- CADEIRA CUMIM 1 - CHEFE DIRETO -> CHEFE CUMIM". O organograma de hoje é derivado de
-- hr.funcionarios.gestor_id (pessoa -> pessoa), que não responde a pergunta que a operação faz:
-- quantas cadeiras eu tenho por cargo e quantas estão VAGAS.
--
-- Aqui a cadeira é a entidade fixa e a pessoa passa por ela. Consequências:
--   · vaga = cadeira sem ocupação aberta (é assim que o recrutamento vai saber o que abrir);
--   · a hierarquia sobrevive à troca de pessoa — o chefe do CUMIM 1 continua sendo o CHEFE DE
--     SALÃO 1 mesmo quando as duas cadeiras trocam de gente;
--   · dá pra ter cadeira vaga com chefe definido, que era impossível no modelo por pessoa.
--
-- gestor_id NÃO é removido agora (0 linhas em uso, mas a coluna ainda é lida em um ou outro lugar);
-- fica deprecada e sai numa limpeza separada.

create table if not exists hr.cadeiras (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  codigo text not null,                     -- 'CUMIM 1', 'CHEFE DE SALAO 2'
  cargo_id integer references hr.cargos(id),
  area_id integer references hr.areas(id),
  -- chefe direto é OUTRA CADEIRA. Raiz = null.
  cadeira_chefe_id uuid references hr.cadeiras(id) on delete set null,
  ordem integer not null default 0,
  ativa boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (bar_id, codigo)
);

create index if not exists idx_cadeiras_bar on hr.cadeiras (bar_id) where ativa;
create index if not exists idx_cadeiras_chefe on hr.cadeiras (cadeira_chefe_id);

comment on table hr.cadeiras is
  'Posições fixas do organograma (headcount). Chefe direto aponta para outra CADEIRA, nunca para uma pessoa.';

-- Quem ocupou a cadeira e quando. Guardar histórico é o que permite responder "quem já passou por
-- essa cadeira" e ligar o desligamento à vaga que ele abriu.
create table if not exists hr.cadeira_ocupacao (
  id uuid primary key default gen_random_uuid(),
  cadeira_id uuid not null references hr.cadeiras(id) on delete cascade,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  inicio date not null default current_date,
  fim date,
  motivo_saida text,
  criado_em timestamptz not null default now()
);

-- Uma cadeira tem no máximo UMA ocupação aberta — senão "vaga" deixa de ter significado.
create unique index if not exists uq_cadeira_ocupacao_aberta
  on hr.cadeira_ocupacao (cadeira_id) where fim is null;
-- E uma pessoa senta em UMA cadeira por vez.
create unique index if not exists uq_funcionario_ocupacao_aberta
  on hr.cadeira_ocupacao (funcionario_id) where fim is null;

comment on table hr.cadeira_ocupacao is
  'Vínculo pessoa x cadeira com histórico. Cadeira sem linha de fim=null está VAGA.';

-- Ciclo na hierarquia: mesma proteção que já existe para gestor_id
-- (hr.fn_funcionario_gestor_sem_ciclo), agora entre cadeiras.
create or replace function hr.fn_cadeira_chefe_sem_ciclo()
returns trigger
language plpgsql
set search_path to 'hr', 'pg_catalog'
as $function$
declare
  v_atual  uuid := new.cadeira_chefe_id;
  v_saltos integer := 0;
begin
  if new.cadeira_chefe_id is null then
    return new;
  end if;
  if new.cadeira_chefe_id = new.id then
    raise exception 'Cadeira % não pode ser chefe de si mesma', new.codigo;
  end if;
  while v_atual is not null and v_saltos < 100 loop
    if v_atual = new.id then
      raise exception 'Chefe inválido: criaria um ciclo no organograma (cadeira %)', new.codigo;
    end if;
    select cadeira_chefe_id into v_atual from hr.cadeiras where id = v_atual;
    v_saltos := v_saltos + 1;
  end loop;
  return new;
end;
$function$;

drop trigger if exists trg_cadeira_chefe_sem_ciclo on hr.cadeiras;
create trigger trg_cadeira_chefe_sem_ciclo
  before insert or update of cadeira_chefe_id on hr.cadeiras
  for each row execute function hr.fn_cadeira_chefe_sem_ciclo();

grant select, insert, update, delete on hr.cadeiras to service_role;
grant select, insert, update, delete on hr.cadeira_ocupacao to service_role;

-- ── Seed ────────────────────────────────────────────────────────────────────────────────────
-- Uma cadeira por pessoa ativa COM cargo, numerada por bar+cargo em ordem alfabética:
-- CUMIM 1..10, GARÇOM 1..13. A hierarquia nasce vazia de propósito — quem sabe quem responde a
-- quem é o RH, e arrastar 56 cadeiras uma vez é mais barato que desfazer um chute errado.
--
-- Ativo SEM cargo não vira cadeira (aparece na tela como "sem cadeira", para alocação manual).
-- Só roda com a tabela vazia, então reaplicar a migration não duplica nada.
insert into hr.cadeiras (bar_id, codigo, cargo_id, area_id, ordem)
select b.bar_id, b.codigo, b.cargo_id, b.area_id, b.rn
from (
  select f.bar_id, f.cargo_id, f.area_id,
         upper(c.nome) || ' ' || row_number() over (partition by f.bar_id, f.cargo_id order by f.nome) as codigo,
         row_number() over (partition by f.bar_id, f.cargo_id order by f.nome) as rn
  from hr.funcionarios f
  join hr.cargos c on c.id = f.cargo_id
  where f.ativo and f.cargo_id is not null
) b
where not exists (select 1 from hr.cadeiras);

insert into hr.cadeira_ocupacao (cadeira_id, funcionario_id, inicio)
select cad.id, b.funcionario_id, coalesce(b.data_admissao, current_date)
from (
  select f.id as funcionario_id, f.bar_id, f.data_admissao,
         upper(c.nome) || ' ' || row_number() over (partition by f.bar_id, f.cargo_id order by f.nome) as codigo
  from hr.funcionarios f
  join hr.cargos c on c.id = f.cargo_id
  where f.ativo and f.cargo_id is not null
) b
join hr.cadeiras cad on cad.bar_id = b.bar_id and cad.codigo = b.codigo
where not exists (select 1 from hr.cadeira_ocupacao);
