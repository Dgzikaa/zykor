-- Busca de codigo ContaHub na ficha tecnica: passa a enxergar codigo NAO mapeado.
--
-- Antes a busca lia so public.produto_contahub_map, entao so achava codigo que ja estava
-- vinculado a alguma ficha -- justamente o que ninguem precisa procurar. O Isaias tentou
-- vincular o 874 ([50%] Gin Melancita Tanqueray) e a tela dizia "nada encontrado".
-- Medido em 20/08/2026: 114 codigos vendidos nos ultimos 12 meses estavam invisiveis
-- (71 no Ordinario, 43 no Deboche), quase todos variacao de promocao [50%]/[DD]/[PP]/[HH].
--
-- prd_desc e preco saem da venda MAIS RECENTE porque o ContaHub RENOMEIA o codigo:
-- o 874 do Ordinario era "[DD] Gin Melancita Tanqueray" ate junho/2026 e virou "[50%]" em julho.

create or replace function operations.fn_prds_contahub(p_bar integer, p_dias integer default 365)
returns table(prd text, prd_desc text, preco_venda numeric, ultima_venda date, mapeado boolean)
language sql stable
set search_path to 'operations', 'gold', 'public'
as $function$
  with v as (
    select distinct on (a.prd)
      a.prd::text as prd,
      a.prd_desc,
      case when a.qtd > 0 then round(((coalesce(a.valorfinal,0) + coalesce(a.desconto,0)) / a.qtd)::numeric, 2) end as preco,
      a.trn_dtgerencial::date as dia
    from gold.gold_contahub_avendas_porproduto_analitico a
    where a.bar_id = p_bar
      and a.trn_dtgerencial::date >= current_date - p_dias
      and coalesce(a.prd_desc,'') !~* '^\s*\[IN\]'   -- ajuste de estoque nao e produto
    order by a.prd, a.trn_dtgerencial desc, a.qtd desc
  ),
  m as (select distinct prd::text p from public.produto_contahub_map where bar_id = p_bar)
  select v.prd, v.prd_desc, v.preco, v.dia, (m.p is not null)
  from v left join m on m.p = v.prd
  order by v.prd::int;
$function$;

grant execute on function operations.fn_prds_contahub(integer, integer) to authenticated, service_role;
