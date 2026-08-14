-- Banco de horas
--
-- Ata de 13/08/2026: "tem que ter banco de horas: que é a soma dos extras, não só daquele mês, mas
-- é um somatório geral... o que da pra fazer é puxar aqui o último status medido pra ter um input
-- inicial e a partir dele ir fazendo cada etapa". Serve também à escala: "usar pessoas que tem mt
-- banco de horas".
--
-- ⚠️ ACHADO QUE TORNAVA ISSO IMPOSSÍVEL: hr.v_espelho_ponto calcula horas_extra com
-- GREATEST(0, trabalhado - previsto), ou seja, JOGA FORA o saldo negativo. E a lista do RH é quase
-- toda negativa (Ana Lacerda -61:36). Por isso aqui existe uma view própria com o saldo COM SINAL,
-- em vez de reaproveitar a de espelho — que continua servindo ao propósito dela (hora extra a pagar).

-- Saldo de abertura: o número que o RH já mede hoje. A partir dele o Zykor acumula sozinho.
create table if not exists hr.banco_horas_saldo_inicial (
  bar_id integer not null,
  funcionario_id integer primary key references hr.funcionarios(id) on delete cascade,
  data_base date not null,            -- saldo medido ATÉ este dia (inclusive)
  minutos integer not null,           -- negativo = deve horas
  origem text,
  criado_em timestamptz not null default now()
);

comment on table hr.banco_horas_saldo_inicial is
  'Saldo de abertura do banco de horas. O movimento posterior e calculado do ponto x escala.';
comment on column hr.banco_horas_saldo_inicial.data_base is
  'O saldo vale ATE esta data; dias seguintes entram pelo calculo.';

-- Lançamentos que não vêm do ponto: uso do banco (folga compensada), acerto em folha, correção.
create table if not exists hr.banco_horas_mov (
  id uuid primary key default gen_random_uuid(),
  bar_id integer not null,
  funcionario_id integer not null references hr.funcionarios(id) on delete cascade,
  data date not null,
  minutos integer not null,           -- negativo consome o banco
  tipo text not null check (tipo in ('uso', 'pagamento', 'ajuste')),
  descricao text,
  registrado_por text,
  criado_em timestamptz not null default now()
);

create index if not exists idx_banco_horas_mov_func on hr.banco_horas_mov (funcionario_id, data);

comment on table hr.banco_horas_mov is
  'Uso do banco (folga), pagamento em folha e ajustes manuais. O que vem do ponto NAO entra aqui.';

-- Saldo do dia COM SINAL. Só conta dia que tem os dois lados: marcação de ponto E escala prevista.
--   · escala sem ponto = FALTA, tratada como ocorrência — virar -8h no banco puniria duas vezes;
--   · ponto sem escala = trabalhou fora da escala, que é decisão de gestão e não entra sozinho.
-- Os dois casos ficam contáveis pela view, para a tela poder mostrar "N dias não considerados".
create or replace view hr.v_banco_horas_dia as
select
  p.bar_id,
  p.funcionario_id,
  p.data,
  p.min_trab,
  p.min_prev,
  (p.min_trab - p.min_prev)::integer as saldo_min,
  (p.min_trab is not null and p.min_prev is not null) as considerado
from hr.v_espelho_ponto p
where p.min_trab is not null and p.min_prev is not null;

comment on view hr.v_banco_horas_dia is
  'Saldo diario COM SINAL (trabalhado - previsto). A v_espelho_ponto zera o negativo; aqui nao.';

/**
 * Saldo consolidado por pessoa até uma data.
 *   saldo = abertura + (trabalhado - previsto) depois da data_base + movimentos
 */
create or replace function hr.fn_banco_horas(p_bar integer, p_ate date default null)
returns table (
  funcionario_id integer,
  nome text,
  area_nome text,
  saldo_inicial_min integer,
  data_base date,
  movimento_ponto_min integer,
  movimento_manual_min integer,
  saldo_min integer,
  dias_considerados integer
)
language sql
stable
security definer
set search_path to 'hr', 'public'
as $function$
  with ate as (select coalesce(p_ate, current_date) as d),
  base as (
    select f.id, f.nome, a.nome as area_nome,
           coalesce(si.minutos, 0) as ini,
           si.data_base
    from hr.funcionarios f
    left join hr.areas a on a.id = f.area_id
    left join hr.banco_horas_saldo_inicial si on si.funcionario_id = f.id
    where f.bar_id = p_bar and f.ativo
  ),
  ponto as (
    select d.funcionario_id, sum(d.saldo_min)::integer as min, count(*)::integer as dias
    from hr.v_banco_horas_dia d, ate
    join base b on b.id = d.funcionario_id
    where d.bar_id = p_bar
      and d.data <= ate.d
      -- sem abertura registrada, conta o histórico inteiro; com abertura, só o que veio depois
      and (b.data_base is null or d.data > b.data_base)
    group by d.funcionario_id
  ),
  manual as (
    select m.funcionario_id, sum(m.minutos)::integer as min
    from hr.banco_horas_mov m, ate
    where m.bar_id = p_bar and m.data <= ate.d
    group by m.funcionario_id
  )
  select b.id, b.nome, b.area_nome,
         b.ini, b.data_base,
         coalesce(p.min, 0), coalesce(mn.min, 0),
         (b.ini + coalesce(p.min, 0) + coalesce(mn.min, 0))::integer,
         coalesce(p.dias, 0)
  from base b
  left join ponto p on p.funcionario_id = b.id
  left join manual mn on mn.funcionario_id = b.id;
$function$;

comment on function hr.fn_banco_horas(integer, date) is
  'Saldo do banco de horas por pessoa: abertura + (trabalhado - previsto) apos a data_base + movimentos.';

grant select, insert, update, delete on hr.banco_horas_saldo_inicial to service_role;
grant select, insert, update, delete on hr.banco_horas_mov to service_role;
grant select on hr.v_banco_horas_dia to service_role;
grant execute on function hr.fn_banco_horas(integer, date) to service_role;

-- ── Abertura com a lista do RH (Ordinário, ata de 13/08/2026) ────────────────────────────────
-- Os ids foram resolvidos e CONFERIDOS um a um contra o cadastro antes de gravar; casar por nome na
-- hora da migration seria frágil demais para um número que encosta em folha.
-- DATA-BASE = 09/08/2026, fim da semana que a mensagem reporta (CMO de 03/08 a 09/08). Se o RH medir
-- até outro dia, é só corrigir data_base — o cálculo posterior se ajusta sozinho.
--
-- FORA DA CARGA: "Rubi" (-19:11). Ela aparece na lista e na súmula da semana, mas o único cadastro
-- com esse nome está INATIVO, sem CPF e com demissão em 31/08 (data futura vinda da planilha). Sem
-- cadastro ativo não há em que pendurar o saldo — corrigir o cadastro e carregar depois.
insert into hr.banco_horas_saldo_inicial (bar_id, funcionario_id, data_base, minutos, origem)
select 3, v.fid, date '2026-08-09', v.min, 'lista RH 13/08/2026'
from (values
  (60,-1931),(62,-1312),(63,377),(69,-1701),(70,-178),(71,-112),(74,101),(75,424),(79,-179),
  (82,-1070),(84,-855),(85,-619),(86,-601),(87,-400),(88,-147),(89,-567),(90,24),(91,-315),
  (92,-518),(95,-268),(97,-2486),(98,-3696),(99,-295),(100,-1066),(102,-828),(105,-253),
  (106,-684),(107,-364),(109,625),(110,971),(111,-856),(113,-995),(114,467),(115,-1000),(117,-362)
) as v(fid, min)
on conflict (funcionario_id) do update
  set minutos = excluded.minutos, data_base = excluded.data_base, origem = excluded.origem;
