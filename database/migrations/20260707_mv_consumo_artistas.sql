-- 2026-07-07 — Materializa fn_consumo_artistas_periodo (consumação/cortesia por artista).
-- Motivo: custava ~12,5s/12m (scan bronze_contahub_avendas_vendasperiodo + subquery de keyword
-- por linha + 2 LATERALs com unaccent por linha — o clássico "unaccent em LATERAL → timeout").
-- Trava a tela de Consumação e alimentava (gated) a rota do ranking. Vira leitura de matview (~3ms).
-- fn_consumo_por_artista (que agrega essa função) fica rápida de brinde.
-- Match artista↔comanda é por linha/data → materializar all-time e filtrar período dá idêntico
-- (validado: 21 artistas, total R$146.388, 0 divergências).

alter function financial.fn_consumo_artistas_periodo(integer, date, date) rename to fn_consumo_artistas_periodo_calc;

create materialized view financial.mv_consumo_artistas as
select b.id as bar_id, f.*
from (select distinct bar_id as id from public.eventos_base) b
cross join lateral financial.fn_consumo_artistas_periodo_calc(b.id, '2020-01-01'::date, current_date) f
with no data;

create unique index ux_mv_consumo_artistas on financial.mv_consumo_artistas (bar_id, vd);
create index ix_mv_consumo_artistas_bar_data on financial.mv_consumo_artistas (bar_id, data);

create or replace function financial.fn_consumo_artistas_periodo(p_bar integer, p_ini date, p_fim date)
returns table(vd bigint, data date, mesa text, motivo text, valor numeric, artista_id integer, artista_nome text, origem text)
language sql stable security definer
set search_path to 'public','financial','operations'
as $function$
  select vd, data, mesa, motivo, valor, artista_id, artista_nome, origem
  from financial.mv_consumo_artistas
  where bar_id = p_bar and data between p_ini and p_fim;
$function$;

grant select on financial.mv_consumo_artistas to authenticated, service_role, anon;

-- popular (build all-time ~30s) — rodar 1x após criar:
--   set statement_timeout='300s'; refresh materialized view financial.mv_consumo_artistas;

-- refresh a cada 6h (CONCURRENTLY; statement_timeout no COMANDO).
select cron.schedule('refresh_mv_consumo_artistas', '15 */6 * * *',
  $cmd$ set statement_timeout='300s'; refresh materialized view concurrently financial.mv_consumo_artistas; $cmd$);
