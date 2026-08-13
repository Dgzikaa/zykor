-- DRE com plano de contas PRÓPRIO por bar — caso Escritório Central (bar_id=7).
--
-- Problema: o de-para (financial.dre_categoria_macro) já aceita bar_id, mas a resolução é
-- SEMPRE "global + exceção do bar". Pro Escritório Central isso não serve: o plano de contas
-- de lá não é uma variação do plano do bar, é outro plano inteiro (não tem CMV, não tem
-- freela, não tem atração; tem Equipe Marketing/CMV/Financeiro/RH, Quitutes Office, Aporte
-- nos Negócios...). Herdando o global, a DRE do bar 7 nasce com 82 linhas zeradas de bar.
--
-- Solução: marcar o bar como "plano próprio" (financial.bar_plano_proprio). Quando marcado,
-- a DRE resolve categoria/esqueleto/rótulo SÓ com as linhas daquele bar — ignora o global.
-- Bares 3/4/5/6 continuam no modelo global+exceção, sem nenhuma mudança de número.
--
-- Estrutura acordada com o Gonza (WhatsApp 12/08/2026), espelhando o plano do CA de lá:
--   Receitas → Marketing → Administrativo → Despesas Operacionais → Despesas de Ocupação
--   → Despesas Sócios → (=) Resultado Operacional → Não Operacionais → (=) Resultado Líquido

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Flag: quais bares têm plano de contas próprio
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists financial.bar_plano_proprio (
  bar_id     integer primary key,
  observacao text,
  criado_em  timestamptz not null default now()
);

comment on table financial.bar_plano_proprio is
  'Bares cujo plano de contas NÃO deriva do plano padrão do bar. Presença aqui faz a DRE '
  '(get_dre_por_ano), o de-para do DFC e o da Orçamentação resolverem só com as linhas do '
  'próprio bar_id, ignorando as linhas globais (bar_id is null).';

alter table financial.bar_plano_proprio enable row level security;
drop policy if exists bar_plano_proprio_select on financial.bar_plano_proprio;
create policy bar_plano_proprio_select on financial.bar_plano_proprio for select to authenticated using (true);
revoke all on financial.bar_plano_proprio from anon;
grant select on financial.bar_plano_proprio to authenticated, service_role;

insert into financial.bar_plano_proprio (bar_id, observacao)
values (7, 'Escritório Central — plano de contas próprio (holding: rateio dos bares como receita, sem CMV/operação)')
on conflict (bar_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Macros da DRE do bar (fonte única dos dropdowns: Central de Categorias e Orçamentação)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function financial.get_dre_macros(p_bar_id integer)
returns table(categoria_macro text, ordem_macro integer, proprio boolean)
language sql stable security definer set search_path = public, financial, pg_catalog
as $$
  with p as (select exists(select 1 from financial.bar_plano_proprio where bar_id = p_bar_id) as ok)
  select d.categoria_macro::text, min(d.ordem_macro)::integer, (select ok from p)
  from financial.dre_categoria_macro d, p
  where case when p.ok then d.bar_id = p_bar_id else (d.bar_id = p_bar_id or d.bar_id is null) end
    and d.categoria_macro is not null
  group by d.categoria_macro
  order by 2, 1;
$$;
grant execute on function financial.get_dre_macros(integer) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) get_dre_por_ano: modo plano próprio
--    Muda 3 pontos (dre_map, canon, esqueleto). Resto idêntico à versão anterior.
--    · dre_map  : quem tem plano próprio só enxerga as próprias linhas.
--    · canon    : passa a filtrar por bar SEMPRE (antes olhava a tabela inteira). Sem isso,
--                 as linhas do bar 7 entrariam no min(categoria_nome) de (macro, ordem_sub)
--                 dos outros bares e trocariam rótulo — "Despesas Operacionais"/"Não
--                 Operacionais" existem nos dois planos. Pros bares 3-6 o filtro é no-op
--                 hoje (a única exceção existente, bar 3, não colide com nenhuma global).
--    · esqueleto: quem tem plano próprio não herda as linhas zeradas do plano do bar.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_dre_por_ano(p_bar_id integer, p_ano integer)
returns table(bar_id integer, mes date, categoria_macro text, ordem_macro integer, ordem_sub integer,
              categoria text, sinal smallint, valor_com_sinal numeric, percentual_receita numeric)
language sql stable set search_path to 'public', 'financial', 'bronze', 'pg_catalog'
as $function$
  with proprio as (
    select exists(select 1 from financial.bar_plano_proprio b where b.bar_id = p_bar_id) as ok
  ),
  dre_map as (
    select distinct on (public.normcat(d.categoria_nome)) public.normcat(d.categoria_nome) as nc,
      d.categoria_macro, d.ordem_macro, d.ordem_sub
    from financial.dre_categoria_macro d, proprio p
    where case when p.ok then d.bar_id = p_bar_id else (d.bar_id = p_bar_id or d.bar_id is null) end
    order by public.normcat(d.categoria_nome), d.bar_id nulls last
  ),
  canon as (
    select d.categoria_macro, d.ordem_sub, min(d.categoria_nome) as categoria_canon
    from financial.dre_categoria_macro d, proprio p
    where case when p.ok then d.bar_id = p_bar_id else (d.bar_id = p_bar_id or d.bar_id is null) end
    group by d.categoria_macro, d.ordem_sub
  ),
  base as (
    select l.bar_id, date_trunc('month', l.data_competencia::timestamptz)::date as mes,
      m.categoria_macro, m.ordem_macro, m.ordem_sub,
      coalesce(c.categoria_canon, nullif(trim(l.categoria_nome), ''), 'Sem categoria') as categoria,
      sum((case when l.tipo = 'RECEITA' then 1 else -1 end) * coalesce(nullif(l.valor_bruto,0), l.valor_pago)) as valor_com_sinal
    from bronze.bronze_contaazul_lancamentos l
    left join dre_map m on m.nc = public.normcat(l.categoria_nome)
    left join canon c on c.categoria_macro = m.categoria_macro and c.ordem_sub = m.ordem_sub
    where l.bar_id = p_bar_id and l.data_competencia >= make_date(p_ano,1,1)
      and l.data_competencia < make_date(p_ano+1,1,1) and l.excluido_em is null
      and coalesce(m.categoria_macro,'') <> 'IGNORAR'
      and not exists (
        select 1 from financial.dre_receita_ignorar_pattern p
        where l.tipo = 'RECEITA'
          and (p.bar_id is null or p.bar_id = l.bar_id)
          and public.normcat(l.categoria_nome) = public.normcat(p.categoria_nome)
          and coalesce(l.descricao,'') ilike p.pattern
      )
    group by l.bar_id, date_trunc('month', l.data_competencia::timestamptz)::date,
      m.categoria_macro, m.ordem_macro, m.ordem_sub,
      coalesce(c.categoria_canon, nullif(trim(l.categoria_nome), ''), 'Sem categoria')
    union all
    -- Esqueleto: cada categoria do plano aparece mesmo sem lançamento (linha zerada em Jan).
    select p_bar_id, make_date(p_ano,1,1), z.categoria_macro, z.ordem_macro, z.ordem_sub, z.categoria_canon, 0::numeric
    from (
      select d.categoria_macro, max(d.ordem_macro) as ordem_macro, d.ordem_sub, min(d.categoria_nome) as categoria_canon
      from financial.dre_categoria_macro d, proprio p
      where case when p.ok then d.bar_id = p_bar_id else (d.bar_id = p_bar_id or d.bar_id is null) end
        and (p.ok or d.categoria_nome not like 'Marketing%')
        and d.categoria_macro <> 'IGNORAR'
        and public.normcat(d.categoria_nome) not in (select nc from dre_map where categoria_macro = 'IGNORAR')
      group by d.categoria_macro, d.ordem_sub
    ) z
  ),
  agg as (
    select base.bar_id, base.mes, coalesce(base.categoria_macro,'Não Mapeado') as categoria_macro,
      base.categoria, max(base.ordem_macro) as ordem_macro, max(base.ordem_sub) as ordem_sub,
      sum(base.valor_com_sinal) as valor_com_sinal
    from base group by base.bar_id, base.mes, coalesce(base.categoria_macro,'Não Mapeado'), base.categoria
  ),
  receita_mes as (
    -- Receita = macro de ordem 1 (bar: "Receita"; escritório: "Receitas").
    select a.bar_id, a.mes, sum(a.valor_com_sinal) as receita_total
    from agg a where a.ordem_macro = 1 group by a.bar_id, a.mes
  )
  select a.bar_id, a.mes, a.categoria_macro, coalesce(a.ordem_macro::integer,99), coalesce(a.ordem_sub::integer,99), a.categoria,
    (case when a.valor_com_sinal < 0 then -1 else 1 end)::smallint, a.valor_com_sinal::numeric(14,2),
    case when r.receita_total > 0 then round(a.valor_com_sinal / r.receita_total * 100, 1) else null end
  from agg a left join receita_mes r on r.bar_id=a.bar_id and r.mes=a.mes;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) aplicar_grupos_dre: respeita plano próprio
--    Antes: só criava categoria que não existisse NEM no bar NEM no global. Com plano
--    próprio isso engolia "Manutenção", "Dividendos", "Aluguel/Condomínio/IPTU" — nomes que
--    já existem no plano do bar — e o Escritório nunca teria linha própria pra eles.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function meta.aplicar_grupos_dre(p_bar integer)
returns integer
language plpgsql set search_path to 'public', 'meta', 'financial', 'bronze', 'pg_catalog'
as $function$
declare v_count integer; v_proprio boolean;
begin
  select exists(select 1 from financial.bar_plano_proprio where bar_id = p_bar) into v_proprio;
  with novos as (
    insert into financial.dre_categoria_macro (bar_id, categoria_nome, categoria_macro, ordem_macro, ordem_sub)
    select c.bar_id, c.nome, g.dre_macro, coalesce(g.dre_ordem_macro, 50), 99
    from bronze.bronze_contaazul_categorias c
    join meta.categoria_grupo g on g.bar_id = c.bar_id and g.categoria_pai_id = c.categoria_pai_id
    where c.bar_id = p_bar and c.ativo and g.dre_macro is not null and nullif(trim(c.nome),'') is not null
      and public.normcat(c.nome) not in (
        select public.normcat(d.categoria_nome) from financial.dre_categoria_macro d
        where d.bar_id = c.bar_id or (not v_proprio and d.bar_id is null)
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_count from novos;
  return v_count;
end
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Plano de contas do Escritório Central (bar_id=7)
-- ─────────────────────────────────────────────────────────────────────────────
-- ordem_macro 1 = bloco de receita (base do % e do "Total de Receitas").
-- ordem_macro 90 = Não Operacionais (entra depois do "Resultado Operacional").
delete from financial.dre_categoria_macro where bar_id = 7;

insert into financial.dre_categoria_macro (bar_id, categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal) values
  -- 1. Receitas
  (7, 'Receita Ordinário',                    'Receitas',              1,  1,  1),
  (7, 'Receita Deboche',                      'Receitas',              1,  2,  1),
  (7, 'Receita Prefeitura',                   'Receitas',              1,  3,  1),
  (7, 'Receita Primo Pobre',                  'Receitas',              1,  4,  1),
  (7, 'Distribuição de Lucros dos Negócios',  'Receitas',              1,  5,  1),
  -- 2. Marketing
  (7, 'Equipe Marketing',                     'Marketing',             2,  1, -1),
  -- 3. Administrativo
  (7, 'Equipe CMV',                           'Administrativo',        3,  1, -1),
  (7, 'Equipe Financeiro',                    'Administrativo',        3,  2, -1),
  (7, 'Equipe RH/DP',                         'Administrativo',        3,  3, -1),
  -- 4. Despesas Operacionais
  (7, 'Administrativo Escritório',            'Despesas Operacionais', 4,  1, -1),
  (7, 'Limpeza',                              'Despesas Operacionais', 4,  2, -1),
  (7, 'Materiais/Equipamentos',               'Despesas Operacionais', 4,  3, -1),
  (7, 'Mensalidades',                         'Despesas Operacionais', 4,  4, -1),
  (7, 'Patrocínios',                          'Despesas Operacionais', 4,  5, -1),
  (7, 'Premiações',                           'Despesas Operacionais', 4,  6, -1),
  (7, 'Quitutes Office',                      'Despesas Operacionais', 4,  7, -1),
  (7, 'Sistemas',                             'Despesas Operacionais', 4,  8, -1),
  -- 5. Despesas de Ocupação
  (7, 'Aluguel/Condomínio/IPTU',              'Despesas de Ocupação',  5,  1, -1),
  (7, 'Manutenção',                           'Despesas de Ocupação',  5,  2, -1),
  (7, 'Utilities (água/luz)',                 'Despesas de Ocupação',  5,  3, -1),
  -- 6. Despesas Sócios
  (7, 'Plano de Saúde Sócios',                'Despesas Sócios',       6,  1, -1),
  (7, 'Reuniões',                             'Despesas Sócios',       6,  2, -1),
  -- 7. Não Operacionais (ordem 90 = fora do Resultado Operacional)
  (7, 'Aporte nos Negócios',                  'Não Operacionais',     90,  1, -1),
  (7, 'Dividendos',                           'Não Operacionais',     90,  2, -1),
  (7, 'Empréstimos',                          'Não Operacionais',     90,  3, -1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) DFC do Escritório (meta.categoria_dfc_map): OPERACIONAL / INVESTIMENTO / FINANCIAMENTO
--    Receita de rateio dos bares = operacional (é o faturamento do escritório).
--    Aporte nos Negócios = investimento. Lucro recebido, dividendo pago e empréstimo =
--    financiamento. CONFIRMAR ESSA CLASSIFICAÇÃO COM O GONZA.
-- ─────────────────────────────────────────────────────────────────────────────
delete from meta.categoria_dfc_map where bar_id = 7;

insert into meta.categoria_dfc_map (bar_id, categoria_ca, grupo_dfc)
select 7, d.categoria_nome,
  case d.categoria_nome
    when 'Distribuição de Lucros dos Negócios' then 'FINANCIAMENTO'
    when 'Aporte nos Negócios'                 then 'INVESTIMENTO'
    when 'Dividendos'                          then 'FINANCIAMENTO'
    when 'Empréstimos'                         then 'FINANCIAMENTO'
    else 'OPERACIONAL'
  end
from financial.dre_categoria_macro d where d.bar_id = 7;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Orçamentação do Escritório (meta.categoria_zykor_map)
--    bloco_dre = macro do plano do escritório (mesmo eixo da DRE).
-- ─────────────────────────────────────────────────────────────────────────────
delete from meta.categoria_zykor_map where bar_id = 7;

insert into meta.categoria_zykor_map (bar_id, categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar)
select 7, d.categoria_nome, d.categoria_nome, d.categoria_macro,
  case when d.ordem_macro = 1 then 'receita' else 'despesa' end, false
from financial.dre_categoria_macro d where d.bar_id = 7;

commit;

-- Repopula a DRE materializada (gold.mv_dre_ano cobre todos os bares ativos × anos).
refresh materialized view gold.mv_dre_ano;
