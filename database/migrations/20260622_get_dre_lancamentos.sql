-- Lançamentos por trás de uma célula da DRE (drill-down do popup).
-- Filtra pela categorização da DRE (financial.dre_categoria_macro), NÃO pela da
-- Orçamentação (meta.categoria_zykor_map) — de-paras diferentes.
-- Identifica a sub-linha por (categoria_macro, canon) onde canon = min(categoria_nome)
-- do grupo (mesma lógica de get_dre_por_ano). Fallback p/ categorias não mapeadas.
create or replace function financial.get_dre_lancamentos(
  p_bar_id int, p_ano int, p_mes int, p_categoria_macro text, p_categoria_canon text
) returns table (
  data_competencia date, data_pagamento date, descricao text,
  pessoa_nome text, categoria_nome text, tipo text, status text, valor numeric
) language sql stable
set search_path to 'financial','bronze','public','pg_catalog'
as $$
  with grupo as (
    select categoria_macro, ordem_sub
    from financial.dre_categoria_macro
    where categoria_macro = p_categoria_macro
    group by categoria_macro, ordem_sub
    having min(categoria_nome) = p_categoria_canon
  ),
  cats as (
    select d.categoria_nome
    from financial.dre_categoria_macro d
    join grupo g on g.categoria_macro = d.categoria_macro and g.ordem_sub = d.ordem_sub
  )
  select
    l.data_competencia, l.data_pagamento, l.descricao,
    l.pessoa_nome, l.categoria_nome, l.tipo, l.status,
    round(coalesce(nullif(l.valor_bruto,0), l.valor_pago), 2) as valor
  from bronze.bronze_contaazul_lancamentos l
  where l.bar_id = p_bar_id
    and l.excluido_em is null
    and l.data_competencia >= make_date(p_ano, p_mes, 1)
    and l.data_competencia <  (make_date(p_ano, p_mes, 1) + interval '1 month')
    and (
      l.categoria_nome in (select categoria_nome from cats)
      or (not exists (select 1 from grupo)
          and coalesce(nullif(btrim(l.categoria_nome),''),'Sem categoria') = p_categoria_canon)
    )
  order by l.data_competencia, abs(coalesce(nullif(l.valor_bruto,0), l.valor_pago)) desc;
$$;
grant execute on function financial.get_dre_lancamentos(int,int,int,text,text) to anon, authenticated, service_role;
