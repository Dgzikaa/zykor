-- Gerenciador de categorias do DFC: TODAS as categorias do CA com movimento no
-- bar/ano + o grupo_dfc atual (resolvido com override por bar; null = não classificada).
-- Alimenta a aba "Categorias" do DFC (dropdown pré-preenchido, editável por bar).
-- Aplicado em produção 2026-06-23 via MCP.
create or replace function financial.get_dfc_categorias(p_bar_id integer, p_ano integer)
returns table(categoria text, qtd bigint, total numeric, grupo_dfc text, na_dre boolean, na_orcamentacao boolean, primeiro date, ultimo date)
language sql stable security definer set search_path = public, financial, meta, bronze
as $$
  select l.categoria_nome::text, count(*),
    round(sum(coalesce(nullif(l.valor_bruto,0), l.valor_pago))::numeric, 2),
    (select dd.grupo_dfc from meta.categoria_dfc_map dd
       where public.normcat(dd.categoria_ca)=public.normcat(l.categoria_nome)
         and (dd.bar_id=p_bar_id or dd.bar_id is null)
       order by dd.bar_id nulls last limit 1),
    exists(select 1 from financial.dre_categoria_macro d where public.normcat(d.categoria_nome)=public.normcat(l.categoria_nome) and (d.bar_id=p_bar_id or d.bar_id is null)),
    exists(select 1 from meta.categoria_zykor_map m where public.normcat(m.categoria_ca)=public.normcat(l.categoria_nome) and (m.bar_id=p_bar_id or m.bar_id is null)),
    min(l.data_competencia), max(l.data_competencia)
  from bronze.bronze_contaazul_lancamentos l
  where l.bar_id=p_bar_id and l.excluido_em is null and extract(year from l.data_competencia)=p_ano
    and l.categoria_nome is not null and trim(l.categoria_nome)<>''
  group by l.categoria_nome
  order by abs(sum(coalesce(nullif(l.valor_bruto,0), l.valor_pago))) desc;
$$;
grant execute on function financial.get_dfc_categorias(integer, integer) to authenticated, anon, service_role;
