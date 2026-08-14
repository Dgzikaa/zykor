-- Organograma ADMINISTRATIVO (ata de 13/08/2026)
--
-- "falta tbm o organograma administrativo... diego galdino tem que se vincular a marcelo barcellos e
-- marcelo barcellos ao pedro gonzalez que é socio". Marcelo e Pedro não existem em hr.funcionarios —
-- e não deviam mesmo: sócio não bate ponto, não entra em escala e não pode contar no CMO nem no
-- absenteísmo.
--
-- Decisão do dono: o administrativo fica SÓ no organograma, sem virar cadastro de funcionário. Por
-- isso a cadeira passa a poder guardar um nome digitado (`ocupante_nome`) em vez de um vínculo com
-- hr.funcionarios. Quem é funcionário de verdade (Diego Galdino) continua entrando pela ocupação
-- normal — os dois convivem na mesma árvore.
alter table hr.cadeiras add column if not exists escopo text not null default 'operacao';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cadeiras_escopo_valido') then
    alter table hr.cadeiras add constraint cadeiras_escopo_valido
      check (escopo in ('operacao', 'administrativo'));
  end if;
end $$;

alter table hr.cadeiras add column if not exists ocupante_nome text;

comment on column hr.cadeiras.escopo is
  'operacao = quadro do bar (entra em headcount/CMO) · administrativo = escritório/sócios, só organograma.';
comment on column hr.cadeiras.ocupante_nome is
  'Nome digitado, para cadeira administrativa cujo ocupante NÃO é cadastrado como funcionário (sócio). Quem tem cadastro usa hr.cadeira_ocupacao.';

create index if not exists idx_cadeiras_escopo on hr.cadeiras (bar_id, escopo) where ativa;
