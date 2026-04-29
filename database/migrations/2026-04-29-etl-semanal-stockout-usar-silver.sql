-- 2026-04-29: ETL semanal stockout — usar silver (mesma fonte da ferramenta)
--
-- Bug reportado pelo socio: %bar em /estrategico/desempenho semanal
-- mostra 21,82% para S17 Ord, mas /ferramentas/stockout mostra 14,61%
-- pro mesmo periodo (20-26/04).
--
-- Causa: 2 fontes diferentes:
--   * etl_gold_desempenho_semanal lia gold.gold_contahub_operacional_stockout
--     com CASE manual de loc_desc (Bar = Chopp+Bar)
--   * /ferramentas/stockout le silver.silver_contahub_operacional_stockout_processado
--     com categoria_local pre-calculada e filtro incluido=true
--   * etl_gold_desempenho_mensal ja usava silver (consistente).
--
-- Fix: alinhar ETL semanal pra usar silver+incluido=true igual mensal e
-- igual a ferramenta. Calculo continua AVG dos % diarios.
--
-- Validacao S17/26 Ord: 21,82% -> 14,61% (bate ferramenta).
--
-- Re-roda todos bares/semanas dos ultimos 60 dias automaticamente.

DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='etl_gold_desempenho_semanal' AND n.nspname='public';

  v_new := v_def;

  v_new := REPLACE(v_new,
    E'fase_stockout_dia AS (\n    SELECT data_consulta,\n      CASE\n        WHEN loc_desc IN (''Preshh'',''Montados'',''Mexido'',''Drinks'',''Drinks Autorais'',''Shot e Dose'',''Batidos'') THEN ''Drinks''\n        WHEN loc_desc IN (''Cozinha'',''Cozinha 1'',''Cozinha 2'') THEN ''Comidas''\n        WHEN loc_desc IN (''Chopp'',''Bar'') THEN ''Bar''\n      END as categoria_local,\n      COUNT(DISTINCT prd) as total,\n      COUNT(DISTINCT prd) FILTER (WHERE prd_venda = ''N'') as stockout\n    FROM gold.gold_contahub_operacional_stockout\n    WHERE bar_id = p_bar_id AND data_consulta BETWEEN v_data_inicio AND v_data_fim\n      AND loc_desc NOT IN (''Pegue e Pague'',''Venda Volante'',''Baldes'',''PP'')\n    GROUP BY data_consulta, categoria_local\n    HAVING CASE WHEN loc_desc IN (''Preshh'',''Montados'',''Mexido'',''Drinks'',''Drinks Autorais'',''Shot e Dose'',''Batidos'') THEN ''Drinks'' WHEN loc_desc IN (''Cozinha'',''Cozinha 1'',''Cozinha 2'') THEN ''Comidas'' WHEN loc_desc IN (''Chopp'',''Bar'') THEN ''Bar'' END IS NOT NULL\n  )',
    E'fase_stockout_dia AS (\n    SELECT data_consulta, categoria_local,\n      COUNT(DISTINCT prd) as total,\n      COUNT(DISTINCT prd) FILTER (WHERE prd_venda = ''N'') as stockout\n    FROM silver.silver_contahub_operacional_stockout_processado\n    WHERE bar_id = p_bar_id\n      AND data_consulta BETWEEN v_data_inicio AND v_data_fim\n      AND incluido = true\n    GROUP BY data_consulta, categoria_local\n  )'
  );

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'etl_gold_desempenho_semanal alinhado com silver';
  ELSE
    RAISE NOTICE 'ja esta alinhado (no-op)';
  END IF;
END $$;

-- Re-rodar ultimos 60 dias
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT b.id as bar_id,
      EXTRACT(isoyear FROM d.dia)::integer as ano,
      EXTRACT(week FROM d.dia)::integer as semana
    FROM operations.bares b CROSS JOIN generate_series(CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE, '1 day') d(dia)
    WHERE b.ativo=true
    ORDER BY ano, semana
  LOOP
    BEGIN PERFORM public.etl_gold_desempenho_semanal(r.bar_id, r.ano, r.semana);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'bar=% ano=% sem=%: %', r.bar_id, r.ano, r.semana, SQLERRM; END;
  END LOOP;
END $$;
