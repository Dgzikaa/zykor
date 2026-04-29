-- 2026-04-29: Adicionar 14 KPIs de producao em etl_gold_planejamento_full
--
-- Bug reportado pelo socio em /estrategico/planejamento-comercial:
--   Mix bebidas (%b/%d/%c) ZERADO, atrasao cozinha/bar ZERADO,
--   stockout drinks/comidas ZERADO. Tela praticamente inutil.
--
-- Causa: operations.eventos_base esta populado corretamente (pelo
-- calculate_evento_metrics), mas o ETL etl_gold_planejamento_full NAO
-- copiava esses 14 campos pro gold.planejamento — INSERT cols e
-- ON CONFLICT omitiam tudo.
--
-- Patch: 4 REPLACEs cirurgicos via DO block (idempotente):
--   1. fase_eb: ler 14 colunas de operations.eventos_base
--   2. INSERT cols: adicionar percent_b/d/c, percent_happy_hour,
--      t_coz/t_bar, atrasinho_cozinha/bar, atrasao_cozinha/bar,
--      percent_stockout, stockout_bebidas/comidas/drinks_perc
--   3. SELECT VALUES: bind eb.eb_* nos novos campos
--   4. ON CONFLICT DO UPDATE: incluir os 14 campos
--
-- versao_etl 5 -> 6.
--
-- Validacao Ord 24/04 (semana cheia):
--   pb 67,85% / pd 21,09% / pc 11,06%
--   atrasao cozinha 226, bar 1.738
--   stockout drinks 9,5%, comidas 0%
--
-- Cron 'gold-desempenho' (jobid 462, 12:00 BRT) ja chama
-- etl_gold_planejamento_all_bars — recalculo automatico todo dia.

DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='etl_gold_planejamento_full' AND n.nspname='public';

  v_new := v_def;

  -- Patch 1: 14 KPIs em fase_eb (lendo de operations.eventos_base)
  v_new := REPLACE(v_new,
    E'      eb.cl_real AS eb_cl_real,\n      eb.real_r AS eb_real_r',
    E'      eb.cl_real AS eb_cl_real,\n      eb.real_r AS eb_real_r,\n      COALESCE(eb.percent_b, 0)::numeric AS eb_percent_b,\n      COALESCE(eb.percent_d, 0)::numeric AS eb_percent_d,\n      COALESCE(eb.percent_c, 0)::numeric AS eb_percent_c,\n      COALESCE(eb.percent_happy_hour, 0)::numeric AS eb_percent_happy_hour,\n      COALESCE(eb.t_coz, 0)::numeric AS eb_t_coz,\n      COALESCE(eb.t_bar, 0)::numeric AS eb_t_bar,\n      COALESCE(eb.atrasinho_cozinha, 0)::integer AS eb_atrasinho_cozinha,\n      COALESCE(eb.atrasinho_bar, 0)::integer AS eb_atrasinho_bar,\n      COALESCE(eb.atrasao_cozinha, 0)::integer AS eb_atrasao_cozinha,\n      COALESCE(eb.atrasao_bar, 0)::integer AS eb_atrasao_bar,\n      COALESCE(eb.percent_stockout, 0)::numeric AS eb_percent_stockout,\n      COALESCE(eb.stockout_bebidas_perc, 0)::numeric AS eb_stockout_bebidas_perc,\n      COALESCE(eb.stockout_comidas_perc, 0)::numeric AS eb_stockout_comidas_perc,\n      COALESCE(eb.stockout_drinks_perc, 0)::numeric AS eb_stockout_drinks_perc'
  );

  -- Patch 2: INSERT cols
  v_new := REPLACE(v_new,
    E'    fat_apos_22h, fat_apos_22h_percent,\n    calculado_em, versao_etl',
    E'    fat_apos_22h, fat_apos_22h_percent,\n    percent_b, percent_d, percent_c, percent_happy_hour,\n    t_coz, t_bar,\n    atrasinho_cozinha, atrasinho_bar, atrasao_cozinha, atrasao_bar,\n    percent_stockout, stockout_bebidas_perc, stockout_comidas_perc, stockout_drinks_perc,\n    calculado_em, versao_etl'
  );

  -- Patch 3: SELECT VALUES
  v_new := REPLACE(v_new,
    E'    CASE WHEN fh.fat_total > 0 THEN (fh.fat_apos_22h / fh.fat_total * 100)::numeric(5,2) ELSE NULL END,\n    NOW(), 5',
    E'    CASE WHEN fh.fat_total > 0 THEN (fh.fat_apos_22h / fh.fat_total * 100)::numeric(5,2) ELSE NULL END,\n    eb.eb_percent_b, eb.eb_percent_d, eb.eb_percent_c, eb.eb_percent_happy_hour,\n    eb.eb_t_coz, eb.eb_t_bar,\n    eb.eb_atrasinho_cozinha, eb.eb_atrasinho_bar, eb.eb_atrasao_cozinha, eb.eb_atrasao_bar,\n    eb.eb_percent_stockout, eb.eb_stockout_bebidas_perc, eb.eb_stockout_comidas_perc, eb.eb_stockout_drinks_perc,\n    NOW(), 6'
  );

  -- Patch 4: ON CONFLICT
  v_new := REPLACE(v_new,
    E'    fat_apos_22h_percent=EXCLUDED.fat_apos_22h_percent,\n    calculado_em=NOW(),\n    versao_etl=5',
    E'    fat_apos_22h_percent=EXCLUDED.fat_apos_22h_percent,\n    percent_b=EXCLUDED.percent_b,\n    percent_d=EXCLUDED.percent_d,\n    percent_c=EXCLUDED.percent_c,\n    percent_happy_hour=EXCLUDED.percent_happy_hour,\n    t_coz=EXCLUDED.t_coz,\n    t_bar=EXCLUDED.t_bar,\n    atrasinho_cozinha=EXCLUDED.atrasinho_cozinha,\n    atrasinho_bar=EXCLUDED.atrasinho_bar,\n    atrasao_cozinha=EXCLUDED.atrasao_cozinha,\n    atrasao_bar=EXCLUDED.atrasao_bar,\n    percent_stockout=EXCLUDED.percent_stockout,\n    stockout_bebidas_perc=EXCLUDED.stockout_bebidas_perc,\n    stockout_comidas_perc=EXCLUDED.stockout_comidas_perc,\n    stockout_drinks_perc=EXCLUDED.stockout_drinks_perc,\n    calculado_em=NOW(),\n    versao_etl=6'
  );

  -- Idempotente: se ja foi aplicado (v_new == v_def), nao executa
  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'etl_gold_planejamento_full atualizado: 14 KPIs adicionados';
  ELSE
    RAISE NOTICE 'etl_gold_planejamento_full ja esta atualizado (no-op)';
  END IF;
END $$;

-- Re-rodar todos os bares pros ultimos 60 dias pra recalcular gold.planejamento
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM operations.bares WHERE ativo=true ORDER BY id LOOP
    BEGIN
      PERFORM public.etl_gold_planejamento_full(r.id, (CURRENT_DATE - INTERVAL '60 days')::date, CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha bar=%: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
