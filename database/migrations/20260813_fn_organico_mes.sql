-- gold.fn_organico_mes — orgânico do Instagram agregado por MÊS-CALENDÁRIO
--
-- A tela mensal de Desempenho montava o mês somando SEMANAS inteiras (cada uma no mês da sua
-- quinta-feira), porque meta.marketing_semanal só tem granularidade de semana. Julho virava
-- 29/06 a 02/08 — 35 dias — enquanto todo o resto da tela é mês-calendário (gold.desempenho de
-- julho é 01/07 a 31/07). No bar 3, os 3 posts de 29–30/06 e 01–02/08 respondiam por 22.153 de
-- alcance que não eram de julho.
--
-- Aqui a conta vai direto ao post, pela data — mesma fonte e mesma regra da aba Comunicação
-- (Feed + Reels, último snapshot por mídia), então as duas telas passam a bater.
--
-- Feito em SQL de propósito: são ~61 snapshots por mídia (15.924 linhas para 260 mídias no bar 3),
-- e puxar isso pelo PostgREST bateria no teto de 1000 linhas e devolveria alcance a menos, calado.
create or replace function gold.fn_organico_mes(p_bar integer, p_ini date, p_fim date)
returns table (mes text, posts integer, alcance bigint, interacao bigint, shares bigint)
language sql
stable
security definer
set search_path to 'gold', 'integrations', 'public'
as $function$
  with ult as (
    select distinct on (i.ig_media_id)
      i.ig_media_id, i.reach, i.likes, i.comments, i.shares, i.saved
    from integrations.instagram_post_insights i
    where i.bar_id = p_bar
    order by i.ig_media_id, i.data_snapshot desc
  )
  select
    to_char(p.timestamp_post, 'YYYY-MM') as mes,
    count(*)::integer as posts,
    coalesce(sum(u.reach), 0)::bigint as alcance,
    coalesce(sum(coalesce(u.likes, 0) + coalesce(u.comments, 0)
                 + coalesce(u.shares, 0) + coalesce(u.saved, 0)), 0)::bigint as interacao,
    coalesce(sum(u.shares), 0)::bigint as shares
  from integrations.instagram_posts p
  left join ult u on u.ig_media_id = p.ig_media_id
  where p.bar_id = p_bar
    and p.media_product_type in ('FEED', 'REELS')
    and p.timestamp_post >= p_ini
    and p.timestamp_post < (p_fim + 1)
  group by 1;
$function$;

comment on function gold.fn_organico_mes(integer, date, date) is
  'Orgânico do Instagram (Feed + Reels, último snapshot por mídia) somado por mês-calendário — mesma regra da aba Comunicação.';

grant execute on function gold.fn_organico_mes(integer, date, date) to service_role;
