-- 2026-04-29: NPS Digital usa janela terça-segunda (sócio prefere)
--
-- Sócio considera S17/2026 = 21/04 (ter) até 27/04 (seg) — bate com 16
-- respostas / NPS 75 do Falae. ETL antes usava semana ISO (segunda-domingo
-- = 20-26/04) que dá 19 respostas (3 a mais do dia 20/04 segunda).
--
-- Fix: deslocar +1 dia o range em fase_nps_digital. Outras métricas semanais
-- (nps_geral, nps_salao, faturamento, tempos, etc) seguem ISO.
--
-- Pós-deploy validado: S17 Ord = 75/16 ✓ bate com Falae.

DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='etl_gold_desempenho_semanal' AND n.nspname='public';

  v_new := v_def;

  v_new := REPLACE(v_new,
    'fase_nps_digital AS (
    SELECT CASE WHEN COUNT(*) > 0 THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2) END as nps_digital,
      COUNT(*)::integer as nps_digital_respostas
    FROM bronze.bronze_falae_respostas WHERE bar_id = p_bar_id AND (created_at AT TIME ZONE ''America/Sao_Paulo'')::date BETWEEN v_data_inicio AND v_data_fim AND search_name = ''NPS Digital''
  )',
    'fase_nps_digital AS (
    -- Janela ter-seg (socio prefere): inicio+1 a fim+1
    SELECT CASE WHEN COUNT(*) > 0 THEN ((COUNT(*) FILTER (WHERE nps >= 9) - COUNT(*) FILTER (WHERE nps <= 6)) * 100.0 / COUNT(*))::numeric(6,2) END as nps_digital,
      COUNT(*)::integer as nps_digital_respostas
    FROM bronze.bronze_falae_respostas WHERE bar_id = p_bar_id AND (created_at AT TIME ZONE ''America/Sao_Paulo'')::date BETWEEN (v_data_inicio + 1) AND (v_data_fim + 1) AND search_name = ''NPS Digital''
  )'
  );

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'NPS Digital agora usa janela ter-seg';
  ELSE
    RAISE NOTICE 'Ja aplicado (no-op)';
  END IF;
END $$;

-- Recalcular gold semanal 2025+2026
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT b, a, s FROM (VALUES (3),(4)) bb(b) CROSS JOIN (VALUES (2025),(2026)) aa(a) CROSS JOIN generate_series(1,52) s WHERE NOT (a=2026 AND s>18) LOOP
    BEGIN PERFORM public.etl_gold_desempenho_semanal(r.b, r.a, r.s); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $$;
