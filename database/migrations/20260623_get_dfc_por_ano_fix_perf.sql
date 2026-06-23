-- FIX de performance (página DFC ficou em branco / timeout no bar 3):
-- a versão accent+override fazia normcat(de-para) DENTRO de 2 LATERALs, re-normalizando
-- ~80 linhas do de-para POR baixa → centenas de milhares de chamadas unaccent → timeout.
-- Agora resolve cada de-para 1x num CTE (DISTINCT ON + override por bar) e faz hash join,
-- normalizando o lançamento 1x por linha. Mesma semântica, ordens de magnitude mais rápido.
-- Aplicado em produção 2026-06-23 via MCP.
create or replace function public.get_dfc_por_ano(p_bar_id integer, p_ano integer, p_so_conciliado boolean default false)
 returns table(mes date, grupo_dfc text, categoria text, categoria_macro text, ordem_macro smallint, ordem_sub smallint, entradas numeric, saidas numeric, net numeric)
 language sql stable set search_path to 'public', 'meta', 'financial', 'bronze', 'pg_catalog'
as $function$
  with dfc_map as (
    select distinct on (public.normcat(categoria_ca)) public.normcat(categoria_ca) as nc, grupo_dfc
    from meta.categoria_dfc_map where bar_id = p_bar_id or bar_id is null
    order by public.normcat(categoria_ca), bar_id nulls last
  ),
  dre_map as (
    select distinct on (public.normcat(categoria_nome)) public.normcat(categoria_nome) as nc, categoria_macro, ordem_macro, ordem_sub
    from financial.dre_categoria_macro where bar_id = p_bar_id or bar_id is null
    order by public.normcat(categoria_nome), bar_id nulls last
  )
  select date_trunc('month', bx.data_pagamento)::date as mes, m.grupo_dfc,
    coalesce(nullif(trim(l.categoria_nome),''),'(sem categoria)') as categoria,
    max(dm.categoria_macro) as categoria_macro, max(dm.ordem_macro) as ordem_macro, max(dm.ordem_sub) as ordem_sub,
    round(sum(case when bx.tipo_evento='RECEITA' then bx.valor_liquido else 0 end)::numeric,2) as entradas,
    round(sum(case when bx.tipo_evento='DESPESA' then bx.valor_liquido else 0 end)::numeric,2) as saidas,
    round(sum((case when bx.tipo_evento='RECEITA' then 1 else -1 end)*bx.valor_liquido)::numeric,2) as net
  from bronze.bronze_contaazul_baixas bx
  join bronze.bronze_contaazul_lancamentos l on l.contaazul_id = bx.id_parcela and l.bar_id = bx.bar_id
  join dfc_map m on m.nc = public.normcat(l.categoria_nome)
  left join dre_map dm on dm.nc = public.normcat(l.categoria_nome)
  where bx.bar_id = p_bar_id and l.excluido_em is null and m.grupo_dfc <> 'AJUSTE'
    and bx.data_pagamento >= make_date(p_ano,1,1) and bx.data_pagamento < make_date(p_ano+1,1,1)
    and (not p_so_conciliado or bx.conciliada = true)
  group by 1,2,3;
$function$;
