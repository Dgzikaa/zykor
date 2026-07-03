-- Cachê EXATO por artista (não rateio): replica o casamento CA->artista do /api/eventos/tagging em SQL.
-- fn_ca_cache_artista casa cada lançamento "Atrações Programação" do CA ao artista taggeado por
-- (1) override corrigir-dia, (2) de-para favorecido->artista, (3) match por tokens significativos
-- (acento-insensível) e soma o VALOR CHEIO de cada um. fn_artista_trajetoria passa a preferir esse
-- valor; fallback só em noite solo (eventos_base.c_art já é o valor cheio do único artista).

create or replace function operations.fn_ca_cache_artista(p_bar int, p_ini date, p_fim date)
returns table(evento_id bigint, artista_id int, cachet numeric)
language sql stable security definer set search_path to 'operations','public','pg_catalog' as $$
  with ca as (
    select l.contaazul_id, l.data_competencia::date comp, coalesce(l.pessoa_nome,'') pessoa,
           coalesce(l.descricao,'') descr, coalesce(l.valor,0)::numeric valor
    from operations.fn_ca_atracao_lancamentos(p_bar, p_ini, p_fim) l
  ),
  ov as (select contaazul_id, data_evento::date de, artista_id from operations.ca_atracao_override where bar_id=p_bar),
  ca_dia as (select ca.*, coalesce(ov.de, ca.comp) dia, ov.artista_id forced from ca left join ov on ov.contaazul_id = ca.contaazul_id),
  ev as (select id, data_evento::date d from public.eventos_base where bar_id=p_bar),
  art as (
    select ea.evento_id, ea.artista_id,
           lower(public.unaccent(coalesce(ba.nome, ea.artista_nome))) nome_norm,
           length(lower(public.unaccent(coalesce(ba.nome, ea.artista_nome)))) nlen
    from operations.evento_artistas ea
    left join operations.bar_artistas ba on ba.id=ea.artista_id
    where ea.bar_id=p_bar and ea.artista_id is not null
  ),
  depara as (select lower(public.unaccent(ca_pessoa_nome)) pnorm, artista_id from operations.artista_ca_pessoa where bar_id=p_bar),
  linha as (
    select cd.contaazul_id, cd.valor, cd.forced, ev.id evento_id,
           lower(public.unaccent(cd.descr||' '||cd.pessoa)) hay, lower(public.unaccent(cd.pessoa)) pessoa_norm
    from ca_dia cd join ev on ev.d = cd.dia
  ),
  matched as (
    select le.valor, le.evento_id,
      coalesce(
        (select a.artista_id from art a where a.evento_id=le.evento_id and a.artista_id=le.forced limit 1),
        (select a.artista_id from art a join depara dp on dp.artista_id=a.artista_id
           where a.evento_id=le.evento_id and dp.pnorm = le.pessoa_norm limit 1),
        (select a.artista_id from art a
           where a.evento_id=le.evento_id
             and exists (select 1 from unnest(regexp_split_to_array(a.nome_norm,'\s+')) tk
                         where tk<>'' and tk not in ('de','da','do','e','no','na','o','a','os','as','di','du','dos','das') and (length(tk)>=2 or tk ~ '\d'))
             and not exists (select 1 from unnest(regexp_split_to_array(a.nome_norm,'\s+')) tk
                         where tk<>'' and tk not in ('de','da','do','e','no','na','o','a','os','as','di','du','dos','das') and (length(tk)>=2 or tk ~ '\d') and position(tk in le.hay)=0)
           order by a.nlen desc limit 1)
      ) mid
    from linha le
  )
  select evento_id, mid as artista_id, sum(valor) cachet from matched where mid is not null group by evento_id, mid;
$$;
revoke execute on function operations.fn_ca_cache_artista(int,date,date) from anon, public;
grant execute on function operations.fn_ca_cache_artista(int,date,date) to service_role, authenticated;

-- fn_artista_trajetoria: cachê/show = COALESCE(CA casado, ea.c_art manual, c_art do evento SE noite solo, 0)
create or replace function operations.fn_artista_trajetoria(p_bar int, p_artista_id int)
returns jsonb language sql stable security definer set search_path to 'operations','public','pg_catalog' as $$
with n_por_evento as (select evento_id, count(*) n from operations.evento_artistas where bar_id = p_bar group by evento_id),
janela as (select min(eb.data_evento::date) mn, max(eb.data_evento::date) mx
  from operations.evento_artistas ea join public.eventos_base eb on eb.id=ea.evento_id
  where ea.bar_id=p_bar and ea.artista_id=p_artista_id),
cc as (select evento_id, cachet from operations.fn_ca_cache_artista(p_bar, (select mn from janela), (select mx from janela)) where artista_id = p_artista_id),
shows as (
  select eb.id, eb.data_evento::date as d, coalesce(eb.dia_semana,'') as dow,
         coalesce(eb.real_r,0)::numeric as fat, coalesce(eb.cl_real,0)::int as publico,
         coalesce(cc.cachet, nullif(ea.c_art,0), case when coalesce(npe.n,1)=1 then nullif(eb.c_art,0) end, 0)::numeric as cache,
         coalesce(eb.t_medio,0)::numeric as ticket, (coalesce(npe.n,1) > 1) as co
  from operations.evento_artistas ea
  join public.eventos_base eb on eb.id = ea.evento_id
  left join n_por_evento npe on npe.evento_id = ea.evento_id
  left join cc on cc.evento_id = eb.id
  where ea.bar_id = p_bar and ea.artista_id = p_artista_id and eb.data_evento::date <= current_date
),
parceiros as (
  select coalesce(ba.nome, ea2.artista_nome) as nome, count(*) as juntos
  from operations.evento_artistas ea2 left join operations.bar_artistas ba on ba.id = ea2.artista_id
  where ea2.bar_id = p_bar and ea2.artista_id <> p_artista_id and ea2.evento_id in (select id from shows)
  group by 1 order by count(*) desc limit 5
)
select case when (select count(*) from shows) = 0 then null else jsonb_build_object(
  'total_shows', (select count(*) from shows),
  'primeiro', (select jsonb_build_object('data',d,'cache',cache,'publico',publico,'fat',fat,'dow',dow) from shows order by d asc limit 1),
  'atual', (select jsonb_build_object('data',d,'cache',cache,'publico',publico,'fat',fat,'dow',dow) from shows order by d desc limit 1),
  'melhor_cache', (select jsonb_build_object('data',d,'valor',cache) from shows where cache>0 order by cache desc, d desc limit 1),
  'pior_cache', (select jsonb_build_object('data',d,'valor',cache) from shows where cache>0 order by cache asc, d asc limit 1),
  'publico_recorde', (select jsonb_build_object('data',d,'valor',publico) from shows order by publico desc, d desc limit 1),
  'fat_recorde', (select jsonb_build_object('data',d,'valor',fat) from shows order by fat desc, d desc limit 1),
  'cache_total', (select coalesce(sum(cache),0) from shows),
  'cache_medio', (select coalesce(avg(cache) filter (where cache>0),0) from shows),
  'publico_medio', (select coalesce(round(avg(publico)),0) from shows),
  'fat_medio', (select coalesce(avg(fat),0) from shows),
  'ticket_medio', (select coalesce(avg(ticket) filter (where ticket>0),0) from shows),
  'cobertura_cache', (select round(100.0*count(*) filter (where cache>0)/nullif(count(*),0)) from shows),
  'dia_favorito', (select dow from shows where dow <> '' group by dow order by count(*) desc, max(d) desc limit 1),
  'parceiros', (select coalesce(jsonb_agg(jsonb_build_object('nome',nome,'juntos',juntos)),'[]'::jsonb) from parceiros),
  'evolucao', (select coalesce(jsonb_agg(jsonb_build_object('data',d,'dow',dow,'cache',cache,'publico',publico,'fat',fat,'co',co) order by d),'[]'::jsonb) from shows)
) end;
$$;
