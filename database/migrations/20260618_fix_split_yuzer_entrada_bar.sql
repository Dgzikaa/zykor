-- 2026-06-18 — Corrige o split Yuzer entrada(ingresso) × bar no gold.planejamento.
-- O ETL deixava tudo em faturamento_entrada_yuzer (bar=0). O ingresso é um PRODUTO
-- com "ingresso" no nome (silver.yuzer_produtos_evento.eh_ingresso). A correção rateia
-- o yuzer_liquido pela proporção do valor de ingresso vs total dos produtos do evento.
-- corrigir_split_yuzer_gold é chamada no fim do etl_gold_planejamento_all_bars (persiste).

CREATE OR REPLACE FUNCTION public.corrigir_split_yuzer_gold(p_bar_id integer, p_ini date, p_fim date)
RETURNS integer LANGUAGE sql
SET search_path TO 'public','gold','silver','pg_catalog'
AS $fn$
  WITH yp AS (
    SELECT data_evento,
      COALESCE(SUM(valor_total) FILTER (WHERE eh_ingresso),0) AS ingr,
      SUM(valor_total) AS tot
    FROM silver.yuzer_produtos_evento
    WHERE bar_id=p_bar_id AND data_evento BETWEEN p_ini AND p_fim
    GROUP BY data_evento
    HAVING SUM(valor_total) > 0
  ), upd AS (
    UPDATE gold.planejamento g SET
      faturamento_entrada_yuzer = ROUND(COALESCE(g.yuzer_liquido,0) * (yp.ingr / yp.tot), 2),
      faturamento_bar_yuzer     = ROUND(COALESCE(g.yuzer_liquido,0) * (1 - yp.ingr / yp.tot), 2)
    FROM yp
    WHERE g.bar_id=p_bar_id AND g.data_evento=yp.data_evento
    RETURNING 1
  )
  SELECT COUNT(*)::int FROM upd;
$fn$;

-- etl_gold_planejamento_all_bars passa a chamar corrigir_split_yuzer_gold por bar
-- (ver o CREATE OR REPLACE completo aplicado em prod; só adiciona o PERFORM após a ETL).
