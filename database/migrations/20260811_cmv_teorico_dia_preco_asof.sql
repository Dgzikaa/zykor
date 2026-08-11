-- =============================================================================
-- Headline do CMV teórico passa a usar PREÇO AS-OF (modelo C) — 11/08/2026
-- =============================================================================
--
-- Antes, gold.cmv_teorico_dia multiplicava a venda pelo custo de gold.produto_cmv — o custo
-- de HOJE. Consequências:
--   * semana fechada mudava de valor sozinha quando um insumo mudava de preço;
--   * a variação de preço contaminava todo o histórico por igual, apagando justamente o
--     efeito "comprei mais caro" que se quer medir;
--   * corrigir uma ficha reescrevia meses passados (foi o que aconteceu com a mandioca:
--     maio saiu de 33,35% para 30,65% no mesmo minuto).
--
-- Agora usa o custo as-of da data (gold.produto_cmv_historico, regravado no modelo C por
-- gold.fn_rebuild_produto_cmv_historico — ver 20260811_rebuild_produto_cmv_historico_asof.sql),
-- com fallback no custo atual para datas anteriores a 26/06/2026, quando o snapshot começa.
--
-- Efeito medido no bar 3 (o preço de julho tinha subido; a preço de hoje isso vazava pra trás):
--   maio 30,65 → 30,65 (sem snapshot, cai no fallback) · junho 29,14 → 29,08
--   julho 30,42 → 29,74 · agosto 30,52 → 30,46
--
-- Refresh CONCURRENTLY continua funcionando (índice único recriado abaixo): passou de
-- ~13,2 s para ~15,4 s no conjunto de fn_refresh_vendas_depara.
-- =============================================================================

drop materialized view if exists gold.cmv_teorico_dia_novo;
drop materialized view if exists gold.cmv_teorico_dia;

create materialized view gold.cmv_teorico_dia as
select v.bar_id, v.data,
       round(sum(v.valor),2) as faturamento,
       round(sum(v.qtd_venda * coalesce(hc.custo, cm.custo, 0)),2) as custo,
       case when sum(v.valor) > 0
            then round(sum(v.qtd_venda * coalesce(hc.custo, cm.custo, 0)) / sum(v.valor) * 100, 2)
       end as cmv_pct
  from silver.vendas_consolidada_dia v
  join public.produto_cardapio pc on pc.bar_id = v.bar_id and pc.codigo = v.cod_interno
  left join gold.produto_cmv cm on cm.bar_id = v.bar_id and cm.produto_id = pc.id
  -- custo as-of: o snapshot mais recente ATÉ aquele dia
  left join lateral (
    select h.custo from gold.produto_cmv_historico h
     where h.bar_id = v.bar_id and h.produto_id = pc.id and h.data_ref <= v.data
     order by h.data_ref desc limit 1
  ) hc on true
 where coalesce(cm.itens_ficha,0) > 0
 group by v.bar_id, v.data;

-- índice único: obrigatório para o REFRESH ... CONCURRENTLY das funções de refresh
create unique index cmv_teorico_dia_uk on gold.cmv_teorico_dia (bar_id, data);
