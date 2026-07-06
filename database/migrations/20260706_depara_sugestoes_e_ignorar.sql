-- Auto-vínculo do de-para ContaHub (aba "fora do de-para" do CMV teórico).
-- 1) Tabela de supressão: prds do ContaHub que NÃO são produto de cardápio
--    (ingresso, vale, taxa, embalagem, couvert...) e devem sumir da lista.
-- 2) fn_depara_sugestoes: pra cada prd órfão, sugere o produto do cardápio por
--    similaridade de nome (pg_trgm), RESPEITANDO o prefixo [DD]/[PP]/[HH]/[PF]/[Banda]
--    (item de delivery não pode cair no produto de salão). Classifica o nível:
--      exato    = nome normalizado idêntico (sim>=0.99) → seguro p/ vincular em massa
--      provavel = 0.45<=sim<0.99 → sugere, mas confirma item a item (Filé≠Frango, com≠sem gás)
-- 3) fn_vendido_fora_depara: passa a excluir os prds ignorados.
-- Aplicada em prod via MCP em 2026-07-06.

create table if not exists public.produto_contahub_ignorar (
  bar_id integer not null,
  prd integer not null,
  prd_desc text,
  motivo text,
  criado_em timestamptz not null default now(),
  primary key (bar_id, prd)
);
grant select, insert, update, delete on public.produto_contahub_ignorar to authenticated, service_role;

-- Detector: exclui ignorados
create or replace function gold.fn_vendido_fora_depara(p_bar_id integer, p_ini date, p_fim date)
 returns table(prd integer, prd_desc text, qtd numeric, valor numeric)
 language sql
 security definer
 set search_path to 'gold', 'silver', 'public'
as $function$
  select v.prd, max(v.prd_desc), sum(v.qtd_consumo), sum(v.valor)
  from silver.vendas_produto_dia v
  where v.bar_id=p_bar_id and v.data between p_ini and p_fim
    and (v.qtd_consumo>0 or v.valor>0)
    and (v.cod_interno is null
         or not exists (select 1 from public.produto_cardapio pc where pc.bar_id=p_bar_id and pc.codigo=v.cod_interno))
    and not exists (select 1 from public.produto_contahub_ignorar ig where ig.bar_id=p_bar_id and ig.prd=v.prd)
  group by v.prd
  order by sum(v.valor) desc, sum(v.qtd_consumo) desc;
$function$;

-- Sugestão de vínculo por nome (pg_trgm), com prefixo respeitado
create or replace function gold.fn_depara_sugestoes(p_bar_id integer, p_ini date, p_fim date)
 returns table(
   prd integer, prd_desc text, qtd numeric, valor numeric,
   sugestao_codigo text, sugestao_nome text, sugestao_ativo boolean,
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
    round(sim::numeric,2) as score,
    case when sim>=0.99 then 'exato' when sim>=0.45 then 'provavel' else 'nenhum' end as nivel,
    (n_fortes>1) as ambiguo
  from scored where rn=1
  order by valor desc, qtd desc;
$function$;

grant execute on function gold.fn_vendido_fora_depara(integer, date, date) to authenticated, anon, service_role;
grant execute on function gold.fn_depara_sugestoes(integer, date, date) to authenticated, anon, service_role;

-- Refresh ENXUTO p/ chamada síncrona na request (vínculo de de-para): só os 3 matviews
-- que a tela CMV teórico lê. Não-concorrente (~6s) → cabe no statement_timeout de 8s do
-- PostgREST. O refresh completo (fn_refresh_consumo_teorico, ~11s, 5 matviews) segue só no cron.
create or replace function silver.fn_refresh_vendas_depara()
 returns void
 language plpgsql
 security definer
 set search_path to 'silver', 'public', 'operations', 'bronze', 'gold'
as $function$
begin
  refresh materialized view silver.vendas_produto_dia;
  refresh materialized view silver.vendas_consolidada_dia;
  refresh materialized view gold.cmv_teorico_dia;
end $function$;
grant execute on function silver.fn_refresh_vendas_depara() to service_role;
