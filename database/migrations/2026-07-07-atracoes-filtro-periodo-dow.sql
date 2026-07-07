-- =====================================================================================
-- Visão do Artista: filtro de período (De/Até) + dia da semana na trajetória e na lista
-- =====================================================================================
-- Recria fn_artista_lista e fn_artista_trajetoria aceitando p_ini/p_fim (intervalo de datas)
-- e p_dow (0=domingo..6=sábado, via extract(dow)). NULL em qualquer um = sem aquele filtro
-- (compatível com os callers antigos). DROP necessário pois muda a assinatura.

DROP FUNCTION IF EXISTS operations.fn_artista_lista(integer);
CREATE OR REPLACE FUNCTION operations.fn_artista_lista(
  p_bar integer, p_ini date DEFAULT NULL, p_fim date DEFAULT NULL, p_dow integer DEFAULT NULL)
 RETURNS TABLE(artista_id integer, nome text, tipo text, foto_url text, shows bigint, primeiro date, ultimo date)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'operations', 'public', 'pg_catalog'
AS $function$
  select ea.artista_id,
         coalesce(max(ba.nome), max(ea.artista_nome)) as nome,
         coalesce(max(ba.tipo),'banda') as tipo,
         max(ba.foto_url) as foto_url,
         count(*) as shows, min(eb.data_evento::date) as primeiro, max(eb.data_evento::date) as ultimo
  from operations.evento_artistas ea
  join public.eventos_base eb on eb.id = ea.evento_id
  left join operations.bar_artistas ba on ba.id = ea.artista_id
  where ea.bar_id = p_bar and ea.artista_id is not null and eb.data_evento::date <= current_date
    and (p_ini is null or eb.data_evento::date >= p_ini)
    and (p_fim is null or eb.data_evento::date <= p_fim)
    and (p_dow is null or extract(dow from eb.data_evento)::int = p_dow)
  group by ea.artista_id
  order by count(*) desc;
$function$;
REVOKE ALL ON FUNCTION operations.fn_artista_lista(integer,date,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operations.fn_artista_lista(integer,date,date,integer) TO service_role, authenticated;

DROP FUNCTION IF EXISTS operations.fn_artista_trajetoria(integer, integer);
CREATE OR REPLACE FUNCTION operations.fn_artista_trajetoria(
  p_bar integer, p_artista_id integer, p_ini date DEFAULT NULL, p_fim date DEFAULT NULL, p_dow integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'operations', 'public', 'pg_catalog'
AS $function$
with n_por_evento as (select evento_id, count(*) n from operations.evento_artistas where bar_id = p_bar group by evento_id),
janela as (select min(eb.data_evento::date) mn, max(eb.data_evento::date) mx
  from operations.evento_artistas ea join public.eventos_base eb on eb.id=ea.evento_id
  where ea.bar_id=p_bar and ea.artista_id=p_artista_id
    and (p_ini is null or eb.data_evento::date >= p_ini)
    and (p_fim is null or eb.data_evento::date <= p_fim)
    and (p_dow is null or extract(dow from eb.data_evento)::int = p_dow)),
cc as (select evento_id, cachet from operations.fn_ca_cache_artista(
         p_bar, coalesce((select mn from janela), current_date), coalesce((select mx from janela), current_date)
       ) where artista_id = p_artista_id),
shows as (
  select eb.id, eb.data_evento::date as d, coalesce(eb.dia_semana,'') as dow,
         coalesce(eb.real_r,0)::numeric as fat,
         greatest(coalesce(eb.cl_real,0), coalesce(eb.publico_real,0))::int as publico,
         coalesce(cc.cachet, nullif(ea.c_art,0), case when coalesce(npe.n,1)=1 then nullif(eb.c_art,0) end, 0)::numeric as cache,
         coalesce(eb.t_medio,0)::numeric as ticket, (coalesce(npe.n,1) > 1) as co
  from operations.evento_artistas ea
  join public.eventos_base eb on eb.id = ea.evento_id
  left join n_por_evento npe on npe.evento_id = ea.evento_id
  left join cc on cc.evento_id = eb.id
  where ea.bar_id = p_bar and ea.artista_id = p_artista_id and eb.data_evento::date <= current_date
    and (p_ini is null or eb.data_evento::date >= p_ini)
    and (p_fim is null or eb.data_evento::date <= p_fim)
    and (p_dow is null or extract(dow from eb.data_evento)::int = p_dow)
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
$function$;
REVOKE ALL ON FUNCTION operations.fn_artista_trajetoria(integer,integer,date,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operations.fn_artista_trajetoria(integer,integer,date,date,integer) TO service_role, authenticated;
