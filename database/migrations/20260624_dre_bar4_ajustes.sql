-- Ajustes na DRE (decisões sócio 23-24/06), foco bar 4 (Deboche):
--   1) "Ajuste Bonificação" (singular) não casava — CA lança no singular, de-para
--      tinha só o plural "Ajuste Bonificações". normcat resolve acento/caixa, não
--      singular/plural. Add do singular -> Custo insumos (CMV). Agora puxa (~R$81k).
--   2) "Administrativo Ordinário" sai do bar 4 (vira só do Ordinário/bar 3).
--   3) "Despesas Grupo Bizu" sai da DRE do bar 4 -> convenção categoria_macro='IGNORAR'
--      (RPC get_dre_por_ano passa a excluir esse macro, lançamentos e linha-zero).

-- 1) Bonificação singular
insert into financial.dre_categoria_macro (bar_id, categoria_nome, categoria_macro, ordem_macro, ordem_sub)
values (null, 'Ajuste Bonificação', 'Custo insumos (CMV)', 3, 6)
on conflict do nothing;

-- 2) Administrativo Ordinário -> só bar 3 (estava global)
update financial.dre_categoria_macro set bar_id = 3
where bar_id is null and public.normcat(categoria_nome) = public.normcat('Administrativo Ordinário');

-- 3) Convenção IGNORAR na RPC da DRE + override do Grupo Bizu no bar 4
create or replace function public.get_dre_por_ano(p_bar_id integer, p_ano integer)
returns table(bar_id integer, mes date, categoria_macro text, ordem_macro integer, ordem_sub integer, categoria text, sinal smallint, valor_com_sinal numeric, percentual_receita numeric)
language sql
stable
set search_path to 'public','financial','bronze','pg_catalog'
as $function$
  with dre_map as (
    select distinct on (public.normcat(categoria_nome)) public.normcat(categoria_nome) as nc,
      categoria_macro, ordem_macro, ordem_sub
    from financial.dre_categoria_macro where bar_id = p_bar_id or bar_id is null
    order by public.normcat(categoria_nome), bar_id nulls last
  ),
  canon as (
    select categoria_macro, ordem_sub, min(categoria_nome) as categoria_canon
    from financial.dre_categoria_macro group by categoria_macro, ordem_sub
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
    group by l.bar_id, date_trunc('month', l.data_competencia::timestamptz)::date,
      m.categoria_macro, m.ordem_macro, m.ordem_sub,
      coalesce(c.categoria_canon, nullif(trim(l.categoria_nome), ''), 'Sem categoria')
    union all
    select p_bar_id, make_date(p_ano,1,1), z.categoria_macro, z.ordem_macro, z.ordem_sub, z.categoria_canon, 0::numeric
    from (
      select categoria_macro, max(ordem_macro) as ordem_macro, ordem_sub, min(categoria_nome) as categoria_canon
      from financial.dre_categoria_macro
      where categoria_nome not like 'Marketing%' and (bar_id is null or bar_id = p_bar_id)
        and categoria_macro <> 'IGNORAR'
      group by categoria_macro, ordem_sub
    ) z
  ),
  agg as (
    select base.bar_id, base.mes, coalesce(base.categoria_macro,'Não Mapeado') as categoria_macro,
      base.categoria, max(base.ordem_macro) as ordem_macro, max(base.ordem_sub) as ordem_sub,
      sum(base.valor_com_sinal) as valor_com_sinal
    from base group by base.bar_id, base.mes, coalesce(base.categoria_macro,'Não Mapeado'), base.categoria
  ),
  receita_mes as (
    select a.bar_id, a.mes, sum(a.valor_com_sinal) as receita_total from agg a where a.categoria_macro='Receita' group by a.bar_id, a.mes
  )
  select a.bar_id, a.mes, a.categoria_macro, coalesce(a.ordem_macro::integer,99), coalesce(a.ordem_sub::integer,99), a.categoria,
    (case when a.valor_com_sinal < 0 then -1 else 1 end)::smallint, a.valor_com_sinal::numeric(14,2),
    case when r.receita_total > 0 then round(a.valor_com_sinal / r.receita_total * 100, 1) else null end
  from agg a left join receita_mes r on r.bar_id=a.bar_id and r.mes=a.mes;
$function$;

insert into financial.dre_categoria_macro (bar_id, categoria_nome, categoria_macro, ordem_macro, ordem_sub)
values (4, 'Despesas Grupo Bizu', 'IGNORAR', 99, 99)
on conflict do nothing;