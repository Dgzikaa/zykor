-- A escala nasce do ORGANOGRAMA, e cada pessoa tem uma escala padrão (19/08/2026).
--
-- POR QUE: o Deboche abriu a tela de Escala vazia — **0 funções, 0 linhas** — porque a escala
-- sempre veio de importar a planilha do Ordinário. Gonza: "não sei se vale importar planilha,
-- vale ele puxar as pessoas do Organograma. E aí a gente ter pra cada pessoa uma escala padrão
-- cadastrada que ele usa como base, e quando começa uma semana nova ele usa como base e vai
-- fazendo as modificações".
--
-- O Deboche tinha 9 cadeiras ocupadas no organograma. Rodado em produção na aplicação:
-- 7 funções criadas, 9 pessoas, 63 linhas (9 × 7 dias). Rodar de novo não duplica.
--
-- Isto é o "espelho do organograma" na prática: o cadastro de quem trabalha é UM só (a cadeira
-- ocupada), e a escala consome. Um bar novo funciona no dia 1, sem planilha e sem cadastrar
-- função na mão.
--
-- Nota de implementação: o enum do turno chama operations.operacao_turno (não turno_escala) —
-- a primeira versão desta função quebrou em runtime por causa disso, porque o corpo de uma
-- função plpgsql não é validado no CREATE.

-- ---------------------------------------------------------------------------
-- Escala padrão: o que a pessoa faz em cada dia da SEMANA (0=domingo .. 6=sábado).
-- É molde, não escala: a escala real continua em operations.escala_dia, dia a dia.
-- ---------------------------------------------------------------------------
create table if not exists operations.escala_padrao (
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  entra time,
  sai time,
  marcador text,
  atualizado_em timestamptz not null default now(),
  primary key (funcionario_id, dia_semana)
);
create index if not exists idx_escala_padrao_bar on operations.escala_padrao (bar_id);
comment on table operations.escala_padrao is
  'Molde semanal por pessoa (0=dom..6=sab). Base pra montar semana nova; a escala real fica em escala_dia.';

grant select, insert, update, delete on operations.escala_padrao to service_role;

-- ---------------------------------------------------------------------------
-- Puxa o organograma pra escala de um período.
--
-- 1) cria as operacao_funcao que faltam, a partir dos CARGOS que têm cadeira ocupada — é o que
--    faz um bar novo funcionar sem ninguém cadastrar função na mão;
-- 2) cria as linhas do período pra quem tem cadeira e ainda não está na escala, usando a
--    escala padrão da pessoa quando existir e FOLGA quando não existir.
--
-- Idempotente: quem já está na escala do período não é tocado. Rodar de novo só traz quem
-- entrou no organograma depois.
-- ---------------------------------------------------------------------------
create or replace function operations.fn_escala_puxar_do_organograma(
  p_bar integer, p_de date, p_ate date
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'operations', 'hr', 'public'
as $function$
declare
  v_funcoes_criadas int := 0;
  v_pessoas int := 0;
  v_linhas int := 0;
begin
  with cargos_do_bar as (
    select distinct cg.id, cg.nome
    from hr.cadeiras c
    join hr.cargos cg on cg.id = c.cargo_id
    join hr.cadeira_ocupacao o on o.cadeira_id = c.id and o.fim is null
    join hr.funcionarios f on f.id = o.funcionario_id and f.ativo
    where c.bar_id = p_bar and c.ativa
  ), novas as (
    insert into operations.operacao_funcao (bar_id, codigo, nome, entra_no_custo, ordem, ativo)
    select p_bar,
           lower(regexp_replace(public.unaccent(cb.nome), '[^a-zA-Z0-9]+', '_', 'g')),
           cb.nome, true,
           100 + row_number() over (order by cb.nome),
           true
    from cargos_do_bar cb
    where not exists (
      select 1 from operations.operacao_funcao f
      where f.bar_id = p_bar
        and lower(public.unaccent(f.nome)) = lower(public.unaccent(cb.nome))
    )
    returning 1
  )
  select count(*) into v_funcoes_criadas from novas;

  with elegiveis as (
    select o.funcionario_id, f.nome as pessoa_nome, cg.nome as cargo_nome
    from hr.cadeiras c
    join hr.cargos cg on cg.id = c.cargo_id
    join hr.cadeira_ocupacao o on o.cadeira_id = c.id and o.fim is null
    join hr.funcionarios f on f.id = o.funcionario_id and f.ativo
    where c.bar_id = p_bar and c.ativa
  ), faltando as (
    select e.*, fu.id as funcao_id
    from elegiveis e
    join operations.operacao_funcao fu
      on fu.bar_id = p_bar
     and lower(public.unaccent(fu.nome)) = lower(public.unaccent(e.cargo_nome))
    where not exists (
      select 1 from operations.escala_dia ed
      where ed.bar_id = p_bar and ed.funcionario_id = e.funcionario_id
        and ed.data between p_de and p_ate
    )
  ), com_slot as (
    -- slot NOVO por função: reusar slot de quem saiu misturaria o histórico das duas pessoas
    select f.*,
           coalesce((select max(ed.slot) from operations.escala_dia ed
                     where ed.bar_id = p_bar and ed.funcao_id = f.funcao_id), 0)
           + row_number() over (partition by f.funcao_id order by f.pessoa_nome) as slot
    from faltando f
  ), dias as (
    select cs.*, d::date as data
    from com_slot cs, generate_series(p_de, p_ate, interval '1 day') d
  ), inseridas as (
    insert into operations.escala_dia
      (bar_id, data, funcao_id, slot, pessoa_nome, funcionario_id, entra, sai, marcador, turno, origem)
    select p_bar, di.data, di.funcao_id, di.slot::smallint, upper(di.pessoa_nome), di.funcionario_id,
           ep.entra, ep.sai,
           -- sem padrão cadastrado a linha nasce FOLGA, que é o estado seguro: aparece na grade
           -- e ninguém é dado como escalado sem alguém ter dito que está.
           coalesce(ep.marcador, case when ep.entra is null then 'FOLGA' end),
           'unico'::operations.operacao_turno, 'organograma'
    from dias di
    left join operations.escala_padrao ep
      on ep.funcionario_id = di.funcionario_id
     and ep.dia_semana = extract(dow from di.data)
    on conflict (bar_id, data, funcao_id, slot) do nothing
    returning 1
  )
  select count(*) into v_linhas from inseridas;

  select count(distinct funcionario_id) into v_pessoas
  from operations.escala_dia
  where bar_id = p_bar and data between p_de and p_ate and origem = 'organograma';

  return jsonb_build_object(
    'funcoes_criadas', v_funcoes_criadas,
    'linhas_criadas', v_linhas,
    'pessoas_do_organograma', v_pessoas
  );
end;
$function$;

grant execute on function operations.fn_escala_puxar_do_organograma(integer, date, date) to service_role;

-- ---------------------------------------------------------------------------
-- Salva o período como ESCALA PADRÃO das pessoas que aparecem nele.
--
-- É assim, e não numa tela de cadastro separada, porque o molde já existe na cabeça da
-- operação como "uma semana normal": o líder monta a semana boa e diz que aquela é a padrão.
-- Só entra quem tem vínculo com o RH — o padrão é por pessoa, não por linha da planilha.
-- ---------------------------------------------------------------------------
create or replace function operations.fn_escala_salvar_padrao(
  p_bar integer, p_de date, p_ate date
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'operations', 'hr', 'public'
as $function$
declare v_linhas int;
begin
  with base as (
    select distinct on (ed.funcionario_id, extract(dow from ed.data))
           ed.funcionario_id, extract(dow from ed.data)::smallint as dia_semana,
           ed.entra, ed.sai, ed.marcador
    from operations.escala_dia ed
    where ed.bar_id = p_bar and ed.data between p_de and p_ate and ed.funcionario_id is not null
    order by ed.funcionario_id, extract(dow from ed.data), ed.data desc
  ), gravadas as (
    insert into operations.escala_padrao (bar_id, funcionario_id, dia_semana, entra, sai, marcador, atualizado_em)
    select p_bar, b.funcionario_id, b.dia_semana, b.entra, b.sai, b.marcador, now()
    from base b
    on conflict (funcionario_id, dia_semana) do update
      set entra = excluded.entra, sai = excluded.sai, marcador = excluded.marcador,
          bar_id = excluded.bar_id, atualizado_em = now()
    returning 1
  )
  select count(*) into v_linhas from gravadas;

  return jsonb_build_object('linhas_gravadas', v_linhas);
end;
$function$;

grant execute on function operations.fn_escala_salvar_padrao(integer, date, date) to service_role;


-- =============================================================================
-- ADENDO (mesma noite): de-para CARGO -> FUNÇÃO, e a função passa a usá-lo.
--
-- O casamento por NOME funcionou no Deboche (que não tinha função nenhuma) e falhou no
-- Ordinário, onde os vocabulários divergem: Cumim×Cumin, ASG×Auxiliar de Serviços Gerais,
-- Host×Recepcionista, Cozinha×Auxiliar de Cozinha, Liderança×Chefe de.../Gerente Operacional.
-- Rodando por nome, criou 11 funções DUPLICADAS na grade do Ordinário (revertido na hora).
--
-- O mapa saiu dos dados, não de chute: cruzei quem está na escala de agosto com o cargo da
-- cadeira que a pessoa ocupa — é o de-para que a operação já pratica.
--
-- Conferido depois de ligar: puxar o Ordinário numa semana vazia distribuiu as 55 pessoas do
-- organograma nas 9 funções existentes, sem criar nenhuma —
--   Garçom 13 · Cumim 8 · Liderança 7 · Barback 6 · ASG 5 · Cozinha 5 · Host 5 · Bartender 4
--   · Segurança 2.
--
-- Ver operations.cargo_funcao (criada na migration operacao_de_para_cargo_funcao) e a versão
-- final de fn_escala_puxar_do_organograma, que tenta o de-para explícito e só cai no nome como
-- rede de segurança — o caminho do bar novo.
-- =============================================================================
