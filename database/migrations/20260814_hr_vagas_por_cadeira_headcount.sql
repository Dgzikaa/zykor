-- Recrutamento amarrado à cadeira (ata de RH de 13/08/2026).
--
-- Regra: um processo seletivo existe para PREENCHER UMA CADEIRA. Se já existe cadeira vaga do
-- cargo pedido, a vaga só ocupa aquela cadeira — ninguém precisa aprovar nada. Se TODAS as
-- cadeiras daquele cargo estão ocupadas, abrir a vaga significa aumentar o quadro: aí o pedido
-- nasce pendente de aprovação de headcount e só vira cadeira de verdade quando alguém aprova.
--
-- Já aplicada no banco em 14/08/2026.

alter table hr.vagas
  add column if not exists cadeira_id        uuid references hr.cadeiras(id) on delete set null,
  add column if not exists cargo_id          integer references hr.cargos(id),
  add column if not exists solicitado_por    text,
  add column if not exists solicitado_em     timestamptz not null default now(),
  -- 'nao_precisa' = havia cadeira vaga; 'pendente'/'aprovado'/'recusado' = aumento de quadro
  add column if not exists headcount_status  text not null default 'nao_precisa',
  add column if not exists headcount_por     text,
  add column if not exists headcount_em      timestamptz,
  add column if not exists headcount_motivo  text,
  add column if not exists fechado_em        timestamptz;

do $$ begin
  alter table hr.vagas add constraint hr_vagas_headcount_status_chk
    check (headcount_status in ('nao_precisa', 'pendente', 'aprovado', 'recusado'));
exception when duplicate_object then null; end $$;

-- uma cadeira não pode ter dois processos seletivos abertos ao mesmo tempo
create unique index if not exists uq_hr_vagas_cadeira_aberta
  on hr.vagas (cadeira_id) where status = 'aberta' and cadeira_id is not null;

create index if not exists idx_hr_vagas_bar_status on hr.vagas (bar_id, status);

comment on column hr.vagas.cadeira_id is
  'Cadeira que esta vaga vai preencher. Vaga sem cadeira = aumento de quadro ainda não aprovado.';
comment on column hr.vagas.headcount_status is
  'nao_precisa = havia cadeira vaga do cargo. pendente/aprovado/recusado = pedido de aumento de quadro.';

-- Cadeiras sem ocupante hoje. É o "quadro vago" que alimenta o recrutamento e, na Fase 7, a
-- linha de vagas abertas da ata semanal.
--
-- ⚠️ `ocupante_nome` também conta como ocupação: os sócios e parte do administrativo não existem
-- em hr.funcionarios (não são folha do bar) e essas cadeiras guardam só o nome em texto. Sem essa
-- condição os 6 sócios apareciam como vaga aberta e o recrutamento pediria processo seletivo
-- pro Pedro Gonzalez.
create or replace view hr.v_cadeiras_vagas as
select c.id            as cadeira_id,
       c.bar_id,
       c.codigo,
       c.cargo_id,
       cg.nome         as cargo_nome,
       c.area_id,
       a.nome          as area_nome,
       c.escopo,
       c.cadeira_chefe_id,
       -- desde quando está vaga: a saída do último ocupante (null = nunca teve ninguém)
       (select max(o2.fim) from hr.cadeira_ocupacao o2 where o2.cadeira_id = c.id) as vaga_desde,
       v.id            as vaga_id,
       v.status        as vaga_status
from hr.cadeiras c
left join hr.cadeira_ocupacao o on o.cadeira_id = c.id and o.fim is null
left join hr.cargos cg on cg.id = c.cargo_id
left join hr.areas  a  on a.id  = c.area_id
left join hr.vagas  v  on v.cadeira_id = c.id and v.status = 'aberta'
where c.ativa
  and o.id is null
  and coalesce(btrim(c.ocupante_nome), '') = '';

comment on view hr.v_cadeiras_vagas is
  'Cadeiras ativas sem ocupante = vagas do quadro. vaga_id preenchido quando já existe processo seletivo.';

grant select on hr.v_cadeiras_vagas to authenticated, service_role;
