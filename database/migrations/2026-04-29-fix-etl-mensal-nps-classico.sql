-- 2026-04-29: Fix etl_gold_desempenho_mensal — NPS deve ser classico, nao media
--
-- Bug reportado pelo socio: na tela /estrategico/desempenho mensal pra
-- mar/2026 mostrava NPS Digital = 8.56 com 152 respostas. No Falae aparece
-- NPS = 56 com 166 respostas. Diferenca total.
--
-- Causa raiz: fase_nps_geral, fase_nps_digital e fase_nps_salao no ETL
-- mensal usavam SUM(total * nps_medio) / SUM(total) — ou seja, "media
-- ponderada do score 0-10". Isso retorna media (8.56), nao NPS classico
-- ((promotores - detratores) / total * 100).
--
-- Mais: liam de silver.nps_diario JSON respostas_por_pesquisa que so
-- guarda total e nps_medio (sem promotores/detratores por pesquisa). Pra
-- calcular NPS classico precisa ler do bronze direto (igual o ETL semanal
-- ja faz).
--
-- Fix: substitui as 3 fases pra usar bronze.bronze_falae_respostas com
-- formula classica (P-D)*100/total.
--
-- Validacao pos-deploy:
--   Mar/2026 Ord:
--     Antes: nps_geral=8.79 (resp=231), digital=8.56 (152), salao=9.22 (79)
--     Depois: nps_geral=56.02 (resp=166), digital=41.38 (87), salao=72.15 (79)
--   Falae mostra: nps=56, total=166 ✓ (bate)
--
-- nps_reservas (do Getin) NAO foi alterado nesta migration porque o JSON
-- '(reserva getin)' ainda nao tem promotores/detratores separados.
-- Sera tratado em migration separada.

DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='etl_gold_desempenho_mensal' AND n.nspname='public';

  v_new := v_def;

  -- fase_nps_geral
  v_new := REPLACE(v_new, 'fase_nps_geral AS (
    SELECT
      CASE WHEN SUM((r.value->>''total'')::integer) > 0
        THEN (SUM((r.value->>''total'')::integer * (r.value->>''nps_medio'')::numeric)
             / SUM((r.value->>''total'')::integer))::numeric(5,2)
      END as nps_geral,
      COALESCE(SUM((r.value->>''total'')::integer), 0) as nps_respostas
    FROM silver.nps_diario n,
      LATERAL jsonb_each(n.respostas_por_pesquisa) as r
    WHERE n.bar_id = p_bar_id
      AND n.data_referencia BETWEEN v_data_inicio AND v_data_fim
      AND n.respostas_por_pesquisa IS NOT NULL
  )', 'fase_nps_geral AS (
    SELECT
      CASE WHEN COUNT(*) > 0
        THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2)
      END as nps_geral,
      COUNT(*)::integer as nps_respostas
    FROM bronze.bronze_falae_respostas
    WHERE bar_id = p_bar_id
      AND (created_at AT TIME ZONE ''America/Sao_Paulo'')::date BETWEEN v_data_inicio AND v_data_fim
  )');

  -- fase_nps_digital
  v_new := REPLACE(v_new, 'fase_nps_digital AS (
    SELECT
      CASE WHEN SUM((respostas_por_pesquisa->''NPS Digital''->>''total'')::integer) > 0
        THEN (SUM((respostas_por_pesquisa->''NPS Digital''->>''total'')::integer * (respostas_por_pesquisa->''NPS Digital''->>''nps_medio'')::numeric)
             / SUM((respostas_por_pesquisa->''NPS Digital''->>''total'')::integer))::numeric(5,2)
      END as nps_digital,
      COALESCE(SUM((respostas_por_pesquisa->''NPS Digital''->>''total'')::integer), 0) as nps_digital_respostas
    FROM silver.nps_diario
    WHERE bar_id = p_bar_id
      AND data_referencia BETWEEN v_data_inicio AND v_data_fim
      AND respostas_por_pesquisa ? ''NPS Digital''
  )', 'fase_nps_digital AS (
    SELECT
      CASE WHEN COUNT(*) > 0
        THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2)
      END as nps_digital,
      COUNT(*)::integer as nps_digital_respostas
    FROM bronze.bronze_falae_respostas
    WHERE bar_id = p_bar_id
      AND (created_at AT TIME ZONE ''America/Sao_Paulo'')::date BETWEEN v_data_inicio AND v_data_fim
      AND search_name = ''NPS Digital''
  )');

  -- fase_nps_salao
  v_new := REPLACE(v_new, 'fase_nps_salao AS (
    SELECT
      CASE WHEN SUM((respostas_por_pesquisa->''Salão''->>''total'')::integer) > 0
        THEN (SUM((respostas_por_pesquisa->''Salão''->>''total'')::integer * (respostas_por_pesquisa->''Salão''->>''nps_medio'')::numeric)
             / SUM((respostas_por_pesquisa->''Salão''->>''total'')::integer))::numeric(5,2)
      END as nps_salao,
      COALESCE(SUM((respostas_por_pesquisa->''Salão''->>''total'')::integer), 0) as nps_salao_respostas
    FROM silver.nps_diario
    WHERE bar_id = p_bar_id
      AND data_referencia BETWEEN v_data_inicio AND v_data_fim
      AND respostas_por_pesquisa ? ''Salão''
  )', 'fase_nps_salao AS (
    SELECT
      CASE WHEN COUNT(*) > 0
        THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2)
      END as nps_salao,
      COUNT(*)::integer as nps_salao_respostas
    FROM bronze.bronze_falae_respostas
    WHERE bar_id = p_bar_id
      AND (created_at AT TIME ZONE ''America/Sao_Paulo'')::date BETWEEN v_data_inicio AND v_data_fim
      AND search_name = ''Salão''
  )');

  -- Idempotente: se ja foi aplicado, REPLACE nao acha pattern e v_new == v_def.
  -- So executa se houve mudanca pra evitar trabalho desnecessario.
  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'etl_gold_desempenho_mensal atualizado: NPS classico nas 3 fases';
  ELSE
    RAISE NOTICE 'etl_gold_desempenho_mensal ja esta atualizado (no-op)';
  END IF;
END $$;

-- Re-rodar todos os meses 2025+2026 pra recalcular gold.desempenho mensal
-- com a nova formula
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT b, a, m FROM (VALUES (3),(4)) AS bb(b)
    CROSS JOIN (VALUES (2025),(2026)) AS aa(a)
    CROSS JOIN generate_series(1,12) AS m
    WHERE NOT (a = 2026 AND m > 4)
  LOOP
    BEGIN
      PERFORM public.etl_gold_desempenho_mensal(r.b, r.a, r.m);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Falha em bar=% ano=% mes=%: %', r.b, r.a, r.m, SQLERRM;
    END;
  END LOOP;
END $$;
