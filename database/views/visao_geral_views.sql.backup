-- Views de agregaÃ§Ã£o para VisÃ£o Geral (anual e trimestral)
-- ObservaÃ§Ã£o:
-- - Usamos somente data_competencia para NIBO (conforme regra interna)
-- - Para Sympla faturamento (sympla_pedidos) nÃ£o hÃ¡ mapeamento claro por bar_id; mantido fora dos cÃ¡lculos agregados por bar
-- - Pessoas Sympla usam sympla_participantes (possui bar_id)
-- - As views sÃ£o MATERIALIZED para performance e devem ser atualizadas via pg_cron

-- ExtensÃ£o de agendamento (Supabase jÃ¡ oferece, mas garantimos)
create extension if not exists pg_cron;

-- =============================================================
-- 1) VIEW ANUAL
-- =============================================================
drop materialized view if exists public.view_visao_geral_anual cascade;
create materialized view public.view_visao_geral_anual as
with keys as (
  select distinct bar_id, extract(year from dt_gerencial)::int as ano from public.contahub_pagamentos
  union
  select distinct bar_id, extract(year from dt_gerencial)::int as ano from public.contahub_periodo
  union
  select distinct bar_id, extract(year from data_evento)::int as ano from public.yuzer_pagamento
  union
  select distinct bar_id, extract(year from data_evento)::int as ano from public.yuzer_produtos
  union
  select distinct bar_id, extract(year from data_checkin)::int as ano from public.sympla_participantes
),
fat_contahub as (
  select bar_id,
         extract(year from dt_gerencial)::int as ano,
         sum(coalesce(liquido, 0))::numeric as faturamento_contahub
  from public.contahub_pagamentos
  group by 1,2
),
fat_yuzer as (
  select bar_id,
         extract(year from data_evento)::int as ano,
         sum(coalesce(valor_liquido, 0))::numeric as faturamento_yuzer
  from public.yuzer_pagamento
  group by 1,2
),
pessoas_contahub as (
  select bar_id,
         extract(year from dt_gerencial)::int as ano,
         sum(coalesce(pessoas, 0))::numeric as pessoas_contahub
  from public.contahub_periodo
  group by 1,2
),
pessoas_yuzer as (
  select bar_id,
         extract(year from data_evento)::int as ano,
         sum(coalesce(quantidade, 0)) filter (
           where lower(coalesce(produto_nome, '')) like '%ingresso%'
              or lower(coalesce(produto_nome, '')) like '%entrada%'
         )::numeric as pessoas_yuzer
  from public.yuzer_produtos
  group by 1,2
),
pessoas_sympla as (
  select bar_id,
         extract(year from data_checkin)::int as ano,
         count(*) filter (where coalesce(fez_checkin, false) = true)::numeric as pessoas_sympla
  from public.sympla_participantes
  group by 1,2
),
reputacao as (
  select extract(year from date)::int as ano,
         avg(stars) filter (
           where stars is not null and stars > 0
         )::numeric as reputacao_media
  from public.google_reviews
  group by 1
)
select
  k.bar_id,
  k.ano,
  coalesce(fc.faturamento_contahub, 0)                      as faturamento_contahub,
  coalesce(fy.faturamento_yuzer, 0)                          as faturamento_yuzer,
  0::numeric                                                 as faturamento_sympla, -- ver nota no topo
  (coalesce(fc.faturamento_contahub, 0) + coalesce(fy.faturamento_yuzer, 0))::numeric as faturamento_total,
  coalesce(pc.pessoas_contahub, 0)                           as pessoas_contahub,
  coalesce(py.pessoas_yuzer, 0)                              as pessoas_yuzer,
  coalesce(ps.pessoas_sympla, 0)                             as pessoas_sympla,
  (coalesce(pc.pessoas_contahub, 0) + coalesce(py.pessoas_yuzer, 0) + coalesce(ps.pessoas_sympla, 0))::numeric as pessoas_total,
  coalesce(r.reputacao_media, 0)                             as reputacao_media
from keys k
left join fat_contahub    fc on fc.bar_id = k.bar_id and fc.ano = k.ano
left join fat_yuzer       fy on fy.bar_id = k.bar_id and fy.ano = k.ano
left join pessoas_contahub pc on pc.bar_id = k.bar_id and pc.ano = k.ano
left join pessoas_yuzer    py on py.bar_id = k.bar_id and py.ano = k.ano
left join pessoas_sympla   ps on ps.bar_id = k.bar_id and ps.ano = k.ano
left join reputacao        r  on r.ano = k.ano;

-- Ãndice para refresh concurrently e performance de lookup
create unique index if not exists idx_view_visao_geral_anual
  on public.view_visao_geral_anual (bar_id, ano);

grant select on table public.view_visao_geral_anual to anon, authenticated;

-- =============================================================
-- 2) VIEW TRIMESTRAL
-- =============================================================
drop materialized view if exists public.view_visao_geral_trimestral cascade;
create materialized view public.view_visao_geral_trimestral as
with keys as (
  select distinct bar_id,
         extract(year from dt_gerencial)::int as ano,
         ((extract(month from dt_gerencial)::int - 1) / 3 + 1)::int as trimestre
  from public.contahub_periodo
  union
  select distinct bar_id,
         extract(year from dt_gerencial)::int as ano,
         ((extract(month from dt_gerencial)::int - 1) / 3 + 1)::int as trimestre
  from public.contahub_pagamentos
  union
  select distinct bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre
  from public.yuzer_produtos
  union
  select distinct bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre
  from public.yuzer_pagamento
  union
  select distinct bar_id,
         extract(year from data_checkin)::int as ano,
         ((extract(month from data_checkin)::int - 1) / 3 + 1)::int as trimestre
  from public.sympla_participantes
  union
  select distinct bar_id,
         extract(year from data_competencia)::int as ano,
         ((extract(month from data_competencia)::int - 1) / 3 + 1)::int as trimestre
  from public.nibo_agendamentos
  union
  select distinct bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre
  from public.view_eventos
),
clientes_contahub as (
  select bar_id,
         extract(year from dt_gerencial)::int as ano,
         ((extract(month from dt_gerencial)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(pessoas, 0))::numeric as pessoas_contahub
  from public.contahub_periodo
  group by 1,2,3
),
clientes_yuzer as (
  select bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(quantidade, 0)) filter (
           where lower(coalesce(produto_nome, '')) like '%ingresso%'
              or lower(coalesce(produto_nome, '')) like '%entrada%'
         )::numeric as pessoas_yuzer
  from public.yuzer_produtos
  group by 1,2,3
),
clientes_sympla as (
  select bar_id,
         extract(year from data_checkin)::int as ano,
         ((extract(month from data_checkin)::int - 1) / 3 + 1)::int as trimestre,
         count(*) filter (where coalesce(fez_checkin, false) = true)::numeric as pessoas_sympla
  from public.sympla_participantes
  group by 1,2,3
),
fat_contahub as (
  select bar_id,
         extract(year from dt_gerencial)::int as ano,
         ((extract(month from dt_gerencial)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(liquido, 0))::numeric as faturamento_contahub
  from public.contahub_pagamentos
  group by 1,2,3
),
fat_yuzer as (
  select bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(valor_liquido, 0))::numeric as faturamento_yuzer
  from public.yuzer_pagamento
  group by 1,2,3
),
cmo as (
  select bar_id,
         extract(year from data_competencia)::int as ano,
         ((extract(month from data_competencia)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(valor, 0))::numeric as cmo_total
  from public.nibo_agendamentos
  where categoria_nome in (
    'SALARIO FUNCIONARIOS','ALIMENTAÃ‡ÃƒO','PROVISÃƒO TRABALHISTA','VALE TRANSPORTE',
    'FREELA ATENDIMENTO','FREELA BAR','FREELA COZINHA','FREELA LIMPEZA','FREELA SEGURANÃ‡A',
    'Marketing','MANUTENÃ‡ÃƒO','Materiais OperaÃ§Ã£o','Outros OperaÃ§Ã£o'
  )
  group by 1,2,3
),
artistica as (
  select bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre,
         avg(coalesce(percent_art_fat, 0))::numeric as artistica_percent
  from public.view_eventos
  group by 1,2,3
)
select
  k.bar_id,
  k.ano,
  k.trimestre,
  coalesce(cc.pessoas_contahub, 0) + coalesce(cy.pessoas_yuzer, 0) + coalesce(cs.pessoas_sympla, 0) as clientes_totais,
  coalesce(c.cmo_total, 0) as cmo_total,
  (coalesce(fc.faturamento_contahub, 0) + coalesce(fy.faturamento_yuzer, 0))::numeric as faturamento_trimestre,
  case when (coalesce(fc.faturamento_contahub, 0) + coalesce(fy.faturamento_yuzer, 0)) > 0
       then (coalesce(c.cmo_total, 0) / (coalesce(fc.faturamento_contahub, 0) + coalesce(fy.faturamento_yuzer, 0))) * 100
       else 0 end::numeric as cmo_percent,
  coalesce(a.artistica_percent, 0) as artistica_percent
from keys k
left join clientes_contahub cc on cc.bar_id = k.bar_id and cc.ano = k.ano and cc.trimestre = k.trimestre
left join clientes_yuzer    cy on cy.bar_id = k.bar_id and cy.ano = k.ano and cy.trimestre = k.trimestre
left join clientes_sympla   cs on cs.bar_id = k.bar_id and cs.ano = k.ano and cs.trimestre = k.trimestre
left join fat_contahub      fc on fc.bar_id = k.bar_id and fc.ano = k.ano and fc.trimestre = k.trimestre
left join fat_yuzer         fy on fy.bar_id = k.bar_id and fy.ano = k.ano and fy.trimestre = k.trimestre
left join cmo               c  on c.bar_id  = k.bar_id and c.ano  = k.ano and c.trimestre  = k.trimestre
left join artistica         a  on a.bar_id  = k.bar_id and a.ano  = k.ano and a.trimestre  = k.trimestre;

create unique index if not exists idx_view_visao_geral_trimestral
  on public.view_visao_geral_trimestral (bar_id, ano, trimestre);

grant select on table public.view_visao_geral_trimestral to anon, authenticated;

-- =============================================================
-- 3) SCHEDULERS (pg_cron)
-- Exemplo de agendamento (execute uma vez no SQL editor):
-- SELECT cron.schedule('refresh_view_visao_geral_anual_diaria', '0 3 * * *',
--   $$refresh materialized view concurrently public.view_visao_geral_anual$$);
-- SELECT cron.schedule('refresh_view_visao_geral_trimestral_horaria', '15 * * * *',
--   $$refresh materialized view concurrently public.view_visao_geral_trimestral$$);
-- Para evitar jobs duplicados, cheque antes:
-- SELECT * FROM cron.job;



