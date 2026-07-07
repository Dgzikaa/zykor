-- 2026-07-07 — Materializa fn_ca_cache_artista (cachê exato CA↔artista).
-- Motivo: a função fazia fuzzy-match (regexp por token + LATERALs) e custava ~415ms/12m,
-- sendo chamada pela rota /analitico/atracoes (ranking), pela rota /analitico/labels e por
-- fn_artista_trajetoria (que caía 690ms → 28ms de brinde). Vira leitura de matview (~10ms).
-- A função pública mantém a MESMA assinatura → nenhum caller muda.
-- O match CA↔artista é por DATA do evento (não depende da janela), então materializar all-time
-- e filtrar o período via eventos_base dá resultado idêntico (validado: 626 linhas, 0 divergências).

alter function operations.fn_ca_cache_artista(integer, date, date) rename to fn_ca_cache_artista_calc;

create materialized view operations.mv_ca_cache_artista as
select b.id as bar_id, f.evento_id, f.artista_id, f.cachet
from (select distinct bar_id as id from public.eventos_base) b
cross join lateral operations.fn_ca_cache_artista_calc(b.id, '2020-01-01'::date, current_date) f;

create unique index ux_mv_ca_cache_artista on operations.mv_ca_cache_artista (bar_id, evento_id, artista_id);
create index ix_mv_ca_cache_artista_evento on operations.mv_ca_cache_artista (evento_id);

create or replace function operations.fn_ca_cache_artista(p_bar integer, p_ini date, p_fim date)
returns table(evento_id bigint, artista_id integer, cachet numeric)
language sql stable security definer
set search_path to 'operations','public','pg_catalog'
as $function$
  select m.evento_id, m.artista_id, m.cachet
  from operations.mv_ca_cache_artista m
  join public.eventos_base e on e.id = m.evento_id
  where m.bar_id = p_bar and e.data_evento::date between p_ini and p_fim;
$function$;

grant select on operations.mv_ca_cache_artista to authenticated, service_role, anon;

-- refresh a cada 6h (CONCURRENTLY: não bloqueia leitura; statement_timeout no COMANDO).
select cron.schedule('refresh_mv_ca_cache_artista', '5 */6 * * *',
  $cmd$ set statement_timeout='180s'; refresh materialized view concurrently operations.mv_ca_cache_artista; $cmd$);
