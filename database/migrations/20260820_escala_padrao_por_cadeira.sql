-- A escala padrão passa a ser da CADEIRA, e a semana futura já nasce preenchida (20/08/2026).
--
-- Gonza: "pras escalas futuras, das semanas futuras, podemos deixar pré-setado a escala padrão
-- que falamos de cada cadeira".
--
-- POR QUE DA CADEIRA E NÃO DA PESSOA: o padrão descreve a POSIÇÃO — "o garçom do slot 2 entra
-- 17h de quarta a domingo". Quando a pessoa sai e outra senta, a escala continua igual; com o
-- padrão preso à pessoa, cada troca de gente zerava o molde e a grade voltava a nascer FOLGA.
--
-- A tabela por pessoa (operations.escala_padrao) CONTINUA existindo como fallback: cobre quem
-- está na escala sem cadeira e guarda as 329 linhas que já haviam sido salvas. A ordem de
-- resolução vira: padrão da CADEIRA > padrão da PESSOA > FOLGA.

create table if not exists operations.escala_padrao_cadeira (
  cadeira_id uuid not null references hr.cadeiras(id) on delete cascade,
  bar_id integer not null,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  entra time,
  sai time,
  marcador text,
  atualizado_em timestamptz not null default now(),
  primary key (cadeira_id, dia_semana)
);
create index if not exists idx_escala_padrao_cadeira_bar on operations.escala_padrao_cadeira (bar_id);
comment on table operations.escala_padrao_cadeira is
  'Molde semanal da CADEIRA (0=dom..6=sab). Quem senta nela herda. Fallback: operations.escala_padrao (por pessoa).';

grant select, insert, update, delete on operations.escala_padrao_cadeira to service_role;

-- Backfill: o que já existia por pessoa vira o padrão da cadeira que ela ocupa hoje.
insert into operations.escala_padrao_cadeira (cadeira_id, bar_id, dia_semana, entra, sai, marcador)
select o.cadeira_id, ep.bar_id, ep.dia_semana, ep.entra, ep.sai, ep.marcador
from operations.escala_padrao ep
join hr.cadeira_ocupacao o on o.funcionario_id = ep.funcionario_id and o.fim is null
join hr.cadeiras c on c.id = o.cadeira_id and c.ativa
on conflict (cadeira_id, dia_semana) do nothing;

-- ---------------------------------------------------------------------------
-- fn_escala_puxar_do_organograma: o padrão da cadeira entra na frente.
-- Resto igual — de-para do cargo > liderança derivada > função de mesmo nome.
-- ---------------------------------------------------------------------------
create or replace function operations.fn_escala_puxar_do_organograma(p_bar integer, p_de date, p_ate date)
 returns jsonb language plpgsql security definer set search_path to 'operations','hr','public'
as $function$
declare
  v_funcoes_criadas int := 0; v_pessoas int := 0; v_linhas int := 0; v_sem_vinculo int := 0;
  v_lideranca uuid;
begin
  select count(distinct pessoa_nome) into v_sem_vinculo
  from operations.escala_dia
  where bar_id = p_bar and data between p_de and p_ate
    and funcionario_id is null and coalesce(pessoa_nome,'') <> ''
    and coalesce(marcador,'') not in ('FOLGA','FÉRIAS');

  -- LIDERANÇA NÃO SE DECLARA, SE DERIVA: líder é quem tem cadeira embaixo da dele.
  select id into v_lideranca from operations.operacao_funcao
   where bar_id = p_bar and ativo and lower(public.unaccent(nome)) = 'lideranca' limit 1;

  with cargos_do_bar as (
    select distinct cg.id, cg.nome, cg.funcao_escala_id,
           exists (select 1 from hr.cadeiras s where s.cadeira_chefe_id = c.id and s.ativa) as tem_equipe
    from hr.cadeiras c
    join hr.cargos cg on cg.id = c.cargo_id
    join hr.cadeira_ocupacao o on o.cadeira_id = c.id and o.fim is null
    join hr.funcionarios f on f.id = o.funcionario_id and f.ativo
    where c.bar_id = p_bar and c.ativa
  ), novas as (
    insert into operations.operacao_funcao (bar_id, codigo, nome, entra_no_custo, ordem, ativo)
    select p_bar, lower(regexp_replace(public.unaccent(cb.nome), '[^a-zA-Z0-9]+', '_', 'g')),
           cb.nome, true, 100 + row_number() over (order by cb.nome), true
    from cargos_do_bar cb
    where cb.funcao_escala_id is null
      and not (cb.tem_equipe and v_lideranca is not null)
      and not exists (select 1 from operations.operacao_funcao f
                      where f.bar_id = p_bar and lower(public.unaccent(f.nome)) = lower(public.unaccent(cb.nome)))
    returning 1
  )
  select count(*) into v_funcoes_criadas from novas;

  with elegiveis as (
    select o.funcionario_id, o.cadeira_id, f.nome as pessoa_nome, cg.funcao_escala_id, cg.nome as cargo_nome,
           exists (select 1 from hr.cadeiras s where s.cadeira_chefe_id = c.id and s.ativa) as tem_equipe
    from hr.cadeiras c
    join hr.cargos cg on cg.id = c.cargo_id
    join hr.cadeira_ocupacao o on o.cadeira_id = c.id and o.fim is null
    join hr.funcionarios f on f.id = o.funcionario_id and f.ativo
    where c.bar_id = p_bar and c.ativa
  ), com_funcao as (
    select e.*, coalesce(e.funcao_escala_id,
                         case when e.tem_equipe then v_lideranca end,
                         fu.id) as funcao_id
    from elegiveis e
    left join operations.operacao_funcao fu
      on fu.bar_id = p_bar and fu.ativo
     and lower(public.unaccent(fu.nome)) = lower(public.unaccent(e.cargo_nome))
  ), faltando as (
    select * from com_funcao cf2
    where cf2.funcao_id is not null
      and not exists (select 1 from operations.escala_dia ed
                      where ed.bar_id = p_bar and ed.funcionario_id = cf2.funcionario_id
                        and ed.data between p_de and p_ate)
  ), com_slot as (
    select f.*, coalesce((select max(ed.slot) from operations.escala_dia ed
                          where ed.bar_id = p_bar and ed.funcao_id = f.funcao_id), 0)
           + row_number() over (partition by f.funcao_id order by f.pessoa_nome) as slot
    from faltando f
  ), dias as (
    select cs.*, d::date as data from com_slot cs, generate_series(p_de, p_ate, interval '1 day') d
  ), inseridas as (
    insert into operations.escala_dia
      (bar_id, data, funcao_id, slot, pessoa_nome, funcionario_id, entra, sai, marcador, turno, origem)
    select p_bar, di.data, di.funcao_id, di.slot::smallint, upper(di.pessoa_nome), di.funcionario_id,
           coalesce(epc.entra, ep.entra),
           coalesce(epc.sai, ep.sai),
           coalesce(epc.marcador, ep.marcador,
                    case when coalesce(epc.entra, ep.entra) is null then 'FOLGA' end),
           'unico'::operations.operacao_turno, 'organograma'
    from dias di
    -- padrão da CADEIRA na frente; o da pessoa é o que sobrou de antes
    left join operations.escala_padrao_cadeira epc
      on epc.cadeira_id = di.cadeira_id and epc.dia_semana = extract(dow from di.data)
    left join operations.escala_padrao ep
      on ep.funcionario_id = di.funcionario_id and ep.dia_semana = extract(dow from di.data)
    on conflict (bar_id, data, funcao_id, slot) do nothing
    returning 1
  )
  select count(*) into v_linhas from inseridas;

  select count(distinct funcionario_id) into v_pessoas
  from operations.escala_dia
  where bar_id = p_bar and data between p_de and p_ate and origem = 'organograma';

  return jsonb_build_object('funcoes_criadas', v_funcoes_criadas, 'linhas_criadas', v_linhas,
                            'pessoas_do_organograma', v_pessoas, 'sem_vinculo_no_periodo', v_sem_vinculo);
end;
$function$;

-- ---------------------------------------------------------------------------
-- Salvar o período como padrão passa a gravar na CADEIRA (e continua gravando por pessoa,
-- pra não perder o molde de quem estiver na escala sem cadeira).
-- ---------------------------------------------------------------------------
create or replace function operations.fn_escala_salvar_padrao(p_bar integer, p_de date, p_ate date)
 returns jsonb language plpgsql security definer set search_path to 'operations','hr','public'
as $function$
declare v_pessoa int; v_cadeira int;
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
  select count(*) into v_pessoa from gravadas;

  with base as (
    select distinct on (o.cadeira_id, extract(dow from ed.data))
           o.cadeira_id, extract(dow from ed.data)::smallint as dia_semana,
           ed.entra, ed.sai, ed.marcador
    from operations.escala_dia ed
    join hr.cadeira_ocupacao o on o.funcionario_id = ed.funcionario_id and o.fim is null
    join hr.cadeiras c on c.id = o.cadeira_id and c.ativa and c.bar_id = p_bar
    where ed.bar_id = p_bar and ed.data between p_de and p_ate and ed.funcionario_id is not null
    order by o.cadeira_id, extract(dow from ed.data), ed.data desc
  ), gravadas as (
    insert into operations.escala_padrao_cadeira (cadeira_id, bar_id, dia_semana, entra, sai, marcador, atualizado_em)
    select b.cadeira_id, p_bar, b.dia_semana, b.entra, b.sai, b.marcador, now()
    from base b
    on conflict (cadeira_id, dia_semana) do update
      set entra = excluded.entra, sai = excluded.sai, marcador = excluded.marcador,
          bar_id = excluded.bar_id, atualizado_em = now()
    returning 1
  )
  select count(*) into v_cadeira from gravadas;

  return jsonb_build_object('linhas_gravadas', v_pessoa, 'linhas_cadeira', v_cadeira);
end;
$function$;

grant execute on function operations.fn_escala_puxar_do_organograma(integer, date, date) to service_role;
grant execute on function operations.fn_escala_salvar_padrao(integer, date, date) to service_role;
