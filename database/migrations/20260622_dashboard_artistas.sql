-- ============================================================
-- Dashboard de Artistas/Atrações (dentro de Beneficiários)
-- Tudo derivado de operations.eventos_base (campo artista é texto livre).
-- Normaliza caixa/acento/espaço para juntar duplicados óbvios.
-- Ticket sempre PONDERADO (sum(real_r)/sum(cl_real)) — coluna t_medio tem outliers.
-- ============================================================

-- 1) Normalizador de nome de artista (immutable p/ poder indexar/agrupar)
create or replace function gold.norm_artista(p text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      translate(
        lower(btrim(coalesce(p,''))),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '\s+', ' ', 'g'
    ),
  '');
$$;

-- 2) View: 1 linha por evento com artista preenchido
create or replace view gold.eventos_artista as
select
  e.id                                   as evento_id,
  e.bar_id,
  e.data_evento,
  gold.norm_artista(e.artista)           as artista_key,
  btrim(e.artista)                       as artista_label,
  e.genero,
  e.nome_evento,
  coalesce(e.c_art,0)                     as c_art,
  coalesce(e.c_prod,0)                    as c_prod,
  coalesce(e.c_art,0)+coalesce(e.c_prod,0) as custo_total,
  e.real_r,
  e.m1_r,
  e.cl_real,
  e.te_real,
  e.tb_real,
  e.t_medio,
  e.percent_art_fat,
  (e.data_evento > current_date)          as futuro
from operations.eventos_base e
where e.artista is not null and btrim(e.artista) <> '';

-- 3) Resumo: 1 linha por artista (lista principal)
create or replace function gold.artistas_resumo(p_bar_id int, p_q text default null)
returns table (
  artista_key text, artista_label text, genero text,
  shows_total int, shows_feitos int, shows_previstos int,
  custo_total numeric, custo_medio numeric,
  fat_total numeric, fat_medio numeric,
  publico_total bigint, publico_medio int,
  ticket_medio numeric, custo_pct_fat numeric,
  primeira date, ultima date, proximo date
) language sql stable as $$
  with base as (
    select * from gold.eventos_artista where bar_id = p_bar_id
  ),
  label as (  -- grafia mais frequente por chave
    select artista_key,
           mode() within group (order by artista_label) as artista_label,
           mode() within group (order by genero)        as genero
    from base group by artista_key
  )
  select
    b.artista_key,
    l.artista_label,
    l.genero,
    count(*)::int                                          as shows_total,
    count(*) filter (where not futuro)::int               as shows_feitos,
    count(*) filter (where futuro)::int                    as shows_previstos,
    round(sum(custo_total))                                as custo_total,
    round(avg(nullif(custo_total,0)))                      as custo_medio,
    round(sum(real_r) filter (where not futuro))          as fat_total,
    round(avg(nullif(real_r,0)) filter (where not futuro))as fat_medio,
    sum(cl_real) filter (where not futuro)                as publico_total,
    round(avg(nullif(cl_real,0)) filter (where not futuro))::int as publico_medio,
    round( sum(real_r) filter (where not futuro and cl_real>0)
         / nullif(sum(cl_real) filter (where not futuro and cl_real>0),0), 2) as ticket_medio,
    round( 100 * sum(custo_total) filter (where not futuro)
         / nullif(sum(real_r) filter (where not futuro),0), 1) as custo_pct_fat,
    min(data_evento)                                      as primeira,
    max(data_evento) filter (where not futuro)            as ultima,
    min(data_evento) filter (where futuro)                as proximo
  from base b join label l using (artista_key)
  where p_q is null or b.artista_key like '%' || gold.norm_artista(p_q) || '%'
  group by b.artista_key, l.artista_label, l.genero
  order by count(*) filter (where not futuro) desc, sum(custo_total) desc;
$$;

-- 4) Detalhe: lista de shows de um artista
create or replace function gold.artista_detalhe(p_bar_id int, p_key text)
returns table (
  evento_id int, data_evento date, dia_semana text, nome_evento text,
  genero text, artista_label text,
  c_art numeric, c_prod numeric, custo_total numeric,
  real_r numeric, m1_r numeric, cl_real int,
  te_real numeric, tb_real numeric, ticket numeric,
  percent_art_fat numeric, futuro boolean
) language sql stable as $$
  select
    evento_id, data_evento,
    trim(to_char(data_evento, 'TMDy')) as dia_semana,
    nome_evento, genero, artista_label,
    round(c_art) , round(c_prod), round(custo_total),
    round(real_r), round(m1_r), cl_real,
    round(te_real,2), round(tb_real,2),
    round(case when cl_real>0 then real_r/cl_real end, 2) as ticket,
    percent_art_fat, futuro
  from gold.eventos_artista
  where bar_id = p_bar_id and artista_key = gold.norm_artista(p_key)
  order by data_evento;
$$;

-- 5) Top produtos vendidos nos dias do artista (shows já realizados)
create or replace function gold.artista_top_produtos(p_bar_id int, p_key text, p_limit int default 12)
returns table (prd_desc text, grp_desc text, qtd numeric, valor numeric, share numeric)
language sql stable as $$
  with dias as (
    select distinct data_evento
    from gold.eventos_artista
    where bar_id = p_bar_id and artista_key = gold.norm_artista(p_key) and not futuro
  ),
  prod as (
    select p.prd_desc, p.grp_desc, sum(p.qtd) as qtd, sum(p.valorfinal) as valor
    from bronze.bronze_contahub_avendas_porproduto_analitico p
    join dias d on d.data_evento = p.trn_dtgerencial
    where p.bar_id = p_bar_id
    group by p.prd_desc, p.grp_desc
  ),
  tot as (select sum(valor) v from prod)
  select prd_desc, grp_desc, round(qtd) as qtd, round(valor) as valor,
         round(100*valor/nullif((select v from tot),0),1) as share
  from prod
  order by valor desc nulls last
  limit greatest(p_limit,1);
$$;

-- 6) Mix por grupo nos dias do artista
create or replace function gold.artista_mix_grupo(p_bar_id int, p_key text)
returns table (grp_desc text, qtd numeric, valor numeric, share numeric)
language sql stable as $$
  with dias as (
    select distinct data_evento
    from gold.eventos_artista
    where bar_id = p_bar_id and artista_key = gold.norm_artista(p_key) and not futuro
  ),
  grp as (
    select coalesce(nullif(btrim(p.grp_desc),''),'(sem grupo)') as grp_desc,
           sum(p.qtd) as qtd, sum(p.valorfinal) as valor
    from bronze.bronze_contahub_avendas_porproduto_analitico p
    join dias d on d.data_evento = p.trn_dtgerencial
    where p.bar_id = p_bar_id
    group by 1
  ),
  tot as (select sum(valor) v from grp)
  select grp_desc, round(qtd), round(valor),
         round(100*valor/nullif((select v from tot),0),1) as share
  from grp order by valor desc nulls last;
$$;

-- 7) Dia COM vs SEM atração (quanto a casa fatura com show)
-- CAVEAT: "sem" = evento sem campo artista preenchido; nem sempre é "sem show".
create or replace function gold.dia_com_sem_atracao(p_bar_id int)
returns table (
  segmento text, dia_semana int, dia_label text,
  qtd_dias bigint, fat_medio numeric, publico_medio int,
  ticket_medio numeric, custo_art_medio numeric
) language sql stable as $$
  with ev as (
    select
      e.data_evento,
      extract(isodow from e.data_evento)::int as dow,
      (e.artista is not null and btrim(e.artista) <> '') as com_atracao,
      e.real_r, e.cl_real,
      coalesce(e.c_art,0)+coalesce(e.c_prod,0) as custo_art
    from operations.eventos_base e
    where e.bar_id = p_bar_id
      and e.data_evento <= current_date
      and coalesce(e.real_r,0) > 0
  ),
  per_dow as (
    select case when com_atracao then 'com' else 'sem' end as segmento,
           dow as dia_semana,
           trim(to_char(date '2024-01-01' + (dow-1), 'TMDay')) as dia_label,
           count(*) as qtd_dias,
           round(avg(real_r)) as fat_medio,
           round(avg(nullif(cl_real,0)))::int as publico_medio,
           round(sum(real_r) filter (where cl_real>0)/nullif(sum(cl_real) filter (where cl_real>0),0),2) as ticket_medio,
           round(avg(nullif(custo_art,0))) as custo_art_medio
    from ev group by 1,2,3
  ),
  geral as (
    select case when com_atracao then 'com' else 'sem' end as segmento,
           null::int as dia_semana, 'Geral' as dia_label,
           count(*) as qtd_dias,
           round(avg(real_r)) as fat_medio,
           round(avg(nullif(cl_real,0)))::int as publico_medio,
           round(sum(real_r) filter (where cl_real>0)/nullif(sum(cl_real) filter (where cl_real>0),0),2) as ticket_medio,
           round(avg(nullif(custo_art,0))) as custo_art_medio
    from ev group by 1
  )
  select * from geral
  union all
  select * from per_dow
  order by dia_semana nulls first, segmento;
$$;

-- Grants
grant execute on function gold.norm_artista(text) to anon, authenticated, service_role;
grant execute on function gold.artistas_resumo(int,text) to anon, authenticated, service_role;
grant execute on function gold.artista_detalhe(int,text) to anon, authenticated, service_role;
grant execute on function gold.artista_top_produtos(int,text,int) to anon, authenticated, service_role;
grant execute on function gold.artista_mix_grupo(int,text) to anon, authenticated, service_role;
grant execute on function gold.dia_com_sem_atracao(int) to anon, authenticated, service_role;
grant select on gold.eventos_artista to anon, authenticated, service_role;
