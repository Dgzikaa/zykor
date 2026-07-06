-- Sinal "sugestao_ja_mapeada" em gold.fn_depara_sugestoes: a sugestão de nome parecido
-- JÁ tem de-para com OUTRO código ContaHub → provavelmente é outro produto (ex.: "Água
-- com gás" sugere "Água sem gás", que já está vinculada ao prd dela). Nesse caso o certo
-- é CADASTRAR o item novo (action cadastrar_depara na rota), não vincular no errado nem
-- só ignorar. Também tira os já-mapeados do "vincular em massa" (exatos).
-- Aplicada em prod via MCP em 2026-07-06.

drop function if exists gold.fn_depara_sugestoes(integer, date, date);
create function gold.fn_depara_sugestoes(p_bar_id integer, p_ini date, p_fim date)
 returns table(
   prd integer, prd_desc text, qtd numeric, valor numeric,
   sugestao_codigo text, sugestao_nome text, sugestao_ativo boolean, sugestao_ja_mapeada boolean,
   score numeric, nivel text, ambiguo boolean
 )
 language sql
 stable
 security definer
 set search_path to 'gold', 'silver', 'public', 'extensions'
as $function$
  with orfaos as (
    select v.prd, max(v.prd_desc) as prd_desc, sum(v.qtd_consumo) as qtd, sum(v.valor) as valor
    from silver.vendas_produto_dia v
    where v.bar_id=p_bar_id and v.data between p_ini and p_fim
      and (v.qtd_consumo>0 or v.valor>0)
      and (v.cod_interno is null
           or not exists (select 1 from public.produto_cardapio pc where pc.bar_id=p_bar_id and pc.codigo=v.cod_interno))
      and not exists (select 1 from public.produto_contahub_ignorar ig where ig.bar_id=p_bar_id and ig.prd=v.prd)
    group by v.prd
  ),
  o as (
    select prd, prd_desc, qtd, valor,
      coalesce(nullif(upper(substring(prd_desc from '^\s*\[([A-Za-z]{2,5})\]')),''),'SALAO') as tag,
      btrim(regexp_replace(lower(public.unaccent(regexp_replace(prd_desc,'^\s*\[[A-Za-z]{2,5}\]\s*','','i'))),'[^a-z0-9]+',' ','g')) as corpo
    from orfaos
  ),
  c as (
    select pc.codigo, pc.nome, pc.ativo,
      coalesce(nullif(upper(substring(pc.nome from '^\s*\[([A-Za-z]{2,5})\]')),''),'SALAO') as tag,
      btrim(regexp_replace(lower(public.unaccent(regexp_replace(pc.nome,'^\s*\[[A-Za-z]{2,5}\]\s*','','i'))),'[^a-z0-9]+',' ','g')) as corpo
    from public.produto_cardapio pc where pc.bar_id=p_bar_id
  ),
  scored as (
    select o.prd, o.prd_desc, o.qtd, o.valor, c.codigo, c.nome, c.ativo,
      similarity(o.corpo,c.corpo) as sim,
      row_number() over (partition by o.prd order by similarity(o.corpo,c.corpo) desc, c.ativo desc) as rn,
      count(*) filter (where similarity(o.corpo,c.corpo)>=0.55) over (partition by o.prd) as n_fortes
    from o join c on c.tag=o.tag
    where o.corpo<>'' and c.corpo<>''
  )
  select prd, prd_desc, qtd, valor,
    case when sim>=0.45 then codigo end as sugestao_codigo,
    case when sim>=0.45 then nome end as sugestao_nome,
    case when sim>=0.45 then ativo end as sugestao_ativo,
    case when sim>=0.45 then exists(
      select 1 from public.produto_contahub_map mm
      where mm.bar_id=p_bar_id and mm.cod_interno=scored.codigo and mm.prd<>scored.prd
    ) end as sugestao_ja_mapeada,
    round(sim::numeric,2) as score,
    case when sim>=0.99 then 'exato' when sim>=0.45 then 'provavel' else 'nenhum' end as nivel,
    (n_fortes>1) as ambiguo
  from scored where rn=1
  order by valor desc, qtd desc;
$function$;
grant execute on function gold.fn_depara_sugestoes(integer, date, date) to authenticated, anon, service_role;
