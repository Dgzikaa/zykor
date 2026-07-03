-- /analitico/atracoes artista-first: lista p/ dropdown + trajetória completa de 1 artista.
-- Cachê por show = COALESCE(evento_artistas.c_art, eventos_base.c_art / nº artistas da noite).
-- (exato em noite solo; rateio em co-headline. Refino futuro = cachê CA por artista via fn_ca_atracao_lancamentos.)

create or replace function operations.fn_artista_lista(p_bar int)
returns table(artista_id int, nome text, tipo text, shows bigint, primeiro date, ultimo date)
language sql stable security definer set search_path to 'operations','public','pg_catalog' as $$
  select ea.artista_id,
         coalesce(max(ba.nome), max(ea.artista_nome)) as nome,
         coalesce(max(ba.tipo),'banda') as tipo,
         count(*) as shows, min(eb.data_evento::date) as primeiro, max(eb.data_evento::date) as ultimo
  from operations.evento_artistas ea
  join public.eventos_base eb on eb.id = ea.evento_id
  left join operations.bar_artistas ba on ba.id = ea.artista_id
  where ea.bar_id = p_bar and ea.artista_id is not null and eb.data_evento::date <= current_date
  group by ea.artista_id
  order by count(*) desc;
$$;

create or replace function operations.fn_artista_trajetoria(p_bar int, p_artista_id int)
returns jsonb language sql stable security definer set search_path to 'operations','public','pg_catalog' as $$
with n_por_evento as (
  select evento_id, count(*) n from operations.evento_artistas where bar_id = p_bar group by evento_id
),
shows as (
  select eb.id, eb.data_evento::date as d, coalesce(eb.dia_semana,'') as dow,
         coalesce(eb.real_r,0)::numeric as fat,
         coalesce(eb.cl_real,0)::int as publico,
         coalesce(nullif(ea.c_art,0), case when npe.n>0 then eb.c_art/npe.n else eb.c_art end, 0)::numeric as cache,
         coalesce(eb.t_medio,0)::numeric as ticket,
         (coalesce(npe.n,1) > 1) as co
  from operations.evento_artistas ea
  join public.eventos_base eb on eb.id = ea.evento_id
  left join n_por_evento npe on npe.evento_id = ea.evento_id
  where ea.bar_id = p_bar and ea.artista_id = p_artista_id and eb.data_evento::date <= current_date
),
parceiros as (
  select coalesce(ba.nome, ea2.artista_nome) as nome, count(*) as juntos
  from operations.evento_artistas ea2
  left join operations.bar_artistas ba on ba.id = ea2.artista_id
  where ea2.bar_id = p_bar and ea2.artista_id <> p_artista_id
    and ea2.evento_id in (select id from shows)
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

revoke execute on function operations.fn_artista_lista(int) from anon, public;
revoke execute on function operations.fn_artista_trajetoria(int,int) from anon, public;
grant execute on function operations.fn_artista_lista(int) to service_role, authenticated;
grant execute on function operations.fn_artista_trajetoria(int,int) to service_role, authenticated;
