-- ============================================================
-- 2026-05-11 — Stockout: RPC canônica + recálculo histórico + alerta Discord
-- ============================================================
-- Problema:
--   Stockout era calculado em 3 lugares com regras diferentes:
--     - /ferramentas/stockout (UI): prd_venda='N' + incluido + filtra
--       Feijoada em não-sábados → ex 6.95%
--     - gold.planejamento (via silver.calcular_stockout_periodo +
--       calculate_evento_metrics): SEM filtrar Feijoada + AVG em vez
--       de sum/sum → ex 6.73% (divergente)
--     - /analitico/eventos (stockout-resumo): usava prd_ativo,
--       sempre = 'S' → sempre 0% (bug grave)
--
-- Decisão de produto (2026-05-11):
--   - Feijoada SEMPRE excluída (não conta como produto em stockout,
--     mesmo no sábado — simplifica a regra e evita falsos positivos)
--   - Cálculo total: sum(stockout) / sum(total) — não AVG das
--     categorias (assim bate com a ferramenta)
-- ============================================================

BEGIN;

-- 1) RPC canônica nova (usada pelas APIs)
CREATE OR REPLACE FUNCTION public.calcular_stockout_dia(p_bar_id integer, p_data date)
RETURNS TABLE (categoria text, total integer, stockout integer, disponiveis integer, pct_stockout numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(categoria_mix, ''), 'OUTROS') AS categoria,
      prd_venda
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id
      AND data_consulta = p_data
      AND incluido = true
      AND prd_desc <> 'Feijoada + Sobremesa'
  )
  SELECT categoria, COUNT(*)::int, COUNT(*) FILTER (WHERE prd_venda='N')::int,
         COUNT(*) FILTER (WHERE prd_venda='S')::int,
         ROUND((COUNT(*) FILTER (WHERE prd_venda='N') * 100.0 / NULLIF(COUNT(*),0))::numeric, 2)
  FROM base GROUP BY categoria
  UNION ALL
  SELECT 'TOTAL', COUNT(*)::int, COUNT(*) FILTER (WHERE prd_venda='N')::int,
         COUNT(*) FILTER (WHERE prd_venda='S')::int,
         ROUND((COUNT(*) FILTER (WHERE prd_venda='N') * 100.0 / NULLIF(COUNT(*),0))::numeric, 2)
  FROM base
  ORDER BY 1;
$function$;

GRANT EXECUTE ON FUNCTION public.calcular_stockout_dia(integer, date) TO anon, authenticated, service_role;

-- 2) Função do ETL: sum/sum em vez de avg/avg + filtra Feijoada
CREATE OR REPLACE FUNCTION silver.calcular_stockout_periodo(p_bar_id integer, p_data_inicio date, p_data_fim date)
RETURNS TABLE(stockout_drinks_perc numeric, stockout_bar_perc numeric, stockout_comidas_perc numeric, stockout_total_perc numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'silver', 'public', 'pg_catalog'
AS $function$
  WITH base AS (
    SELECT
      categoria_local,
      COUNT(DISTINCT prd) AS total,
      COUNT(DISTINCT prd) FILTER (WHERE prd_venda='N') AS sem_venda
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id
      AND data_consulta BETWEEN p_data_inicio AND p_data_fim
      AND incluido = true
      AND categoria_local IN ('Drinks','Bar','Comidas')
      AND prd_desc <> 'Feijoada + Sobremesa'
    GROUP BY categoria_local
  ),
  totals AS (
    SELECT
      SUM(total) FILTER (WHERE categoria_local='Drinks') AS t_drinks,
      SUM(sem_venda) FILTER (WHERE categoria_local='Drinks') AS s_drinks,
      SUM(total) FILTER (WHERE categoria_local='Bar') AS t_bar,
      SUM(sem_venda) FILTER (WHERE categoria_local='Bar') AS s_bar,
      SUM(total) FILTER (WHERE categoria_local='Comidas') AS t_comidas,
      SUM(sem_venda) FILTER (WHERE categoria_local='Comidas') AS s_comidas,
      SUM(total) AS t_all,
      SUM(sem_venda) AS s_all
    FROM base
  )
  SELECT
    (s_drinks::numeric / NULLIF(t_drinks,0) * 100)::numeric(5,2),
    (s_bar::numeric / NULLIF(t_bar,0) * 100)::numeric(5,2),
    (s_comidas::numeric / NULLIF(t_comidas,0) * 100)::numeric(5,2),
    (s_all::numeric / NULLIF(t_all,0) * 100)::numeric(5,2)
  FROM totals;
$function$;

-- 3) Alerta Discord stockout > threshold (cron diário 09:30 BRT)
CREATE OR REPLACE FUNCTION public.verificar_stockout_alto_alerta_discord(p_threshold numeric DEFAULT 25)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_data date := current_date - interval '1 day';
  v_bar int;
  v_nome_bar text;
  v_mensagem text;
  v_acumulado text := '';
  v_resultados int := 0;
  r record;
  v_top_produtos text;
BEGIN
  FOR v_bar IN SELECT unnest(ARRAY[3,4]) LOOP
    SELECT * INTO r FROM public.calcular_stockout_dia(v_bar, v_data) WHERE categoria='TOTAL';
    IF r.total IS NULL OR r.total = 0 THEN CONTINUE; END IF;
    IF r.pct_stockout < p_threshold THEN CONTINUE; END IF;

    SELECT nome INTO v_nome_bar FROM operations.bares WHERE id = v_bar;
    v_mensagem := format(E'**%s**\nStockout %s%% (%s/%s itens)\n', v_nome_bar, r.pct_stockout, r.stockout, r.total);

    FOR r IN SELECT * FROM public.calcular_stockout_dia(v_bar, v_data) WHERE categoria <> 'TOTAL' AND stockout > 0 ORDER BY pct_stockout DESC LOOP
      v_mensagem := v_mensagem || format(E'• %s: %s%% (%s/%s)\n', r.categoria, r.pct_stockout, r.stockout, r.total);
    END LOOP;

    SELECT string_agg('• ' || prd_desc, E'\n')
      INTO v_top_produtos
      FROM (
        SELECT prd_desc FROM silver.silver_contahub_operacional_stockout_processado
        WHERE bar_id=v_bar AND data_consulta=v_data AND incluido=true
          AND prd_venda='N' AND prd_desc <> 'Feijoada + Sobremesa'
        ORDER BY prd_desc LIMIT 5
      ) t;
    IF v_top_produtos IS NOT NULL THEN
      v_mensagem := v_mensagem || E'\n_Esgotados (top 5):_\n' || v_top_produtos;
    END IF;

    v_acumulado := v_acumulado || E'\n' || v_mensagem;
    v_resultados := v_resultados + 1;
  END LOOP;

  IF v_resultados = 0 THEN RETURN 'OK_SEM_ALERTA'; END IF;

  RETURN public.enviar_alerta_discord_sistema_dedup(
    3, 'alerta', 'stockout_alto',
    format('🚨 Stockout alto em %s', to_char(v_data, 'DD/MM')),
    v_acumulado,
    16753920,
    'stockout_alto_' || v_data::text,
    'alertas_criticos'
  );
END;
$function$;

-- 4) Cron diário às 09:30 BRT (12:30 UTC) — depois do ETL gold.planejamento
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='alerta-stockout-alto-d1') THEN
    PERFORM cron.unschedule('alerta-stockout-alto-d1');
  END IF;
  PERFORM cron.schedule('alerta-stockout-alto-d1', '30 12 * * *',
    'SELECT public.verificar_stockout_alto_alerta_discord(25);');
END $$;

COMMIT;

-- 5) Recálculo do histórico (eventos_base + gold.planejamento) precisa ser
-- feito como DDL separado pq cada chamada pode tomar tempo. Comandos executados
-- manualmente em 2026-05-11:
--
-- a) Recalcular eventos_base (usa silver.calcular_stockout_periodo nova):
--    DO $$ DECLARE r record; BEGIN
--      FOR r IN SELECT id FROM operations.eventos_base
--               WHERE data_evento BETWEEN '2025-01-01' AND current_date
--      LOOP
--        BEGIN PERFORM public.calculate_evento_metrics(r.id);
--        EXCEPTION WHEN OTHERS THEN NULL; END;
--      END LOOP;
--    END $$;
--
-- b) Recalcular gold.planejamento em chunks mensais (evita overflow):
--    DO $$ DECLARE v_bar int; v_ini date; v_fim date;
--    BEGIN
--      FOREACH v_bar IN ARRAY ARRAY[3,4] LOOP
--        v_ini := '2025-01-01'::date;
--        WHILE v_ini <= current_date LOOP
--          v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
--          IF v_fim > current_date THEN v_fim := current_date; END IF;
--          BEGIN PERFORM public.etl_gold_planejamento_full(v_bar, v_ini, v_fim);
--          EXCEPTION WHEN OTHERS THEN NULL; END;
--          v_ini := (v_ini + interval '1 month')::date;
--        END LOOP;
--      END LOOP;
--    END $$;
