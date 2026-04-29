-- 2026-04-29: Popular couvert_vr_contahub em gold.planejamento
--
-- Bug reportado pelo socio: em /estrategico/planejamento-comercial bar
-- Deboche, a coluna $couvert vem zerada. Tem que pegar o vr_couvert do
-- relatorio de periodo do ContaHub pra aquele dia.
--
-- Fonte: bronze.bronze_contahub_avendas_vendasperiodo.vd_vrcouvert
-- (mesma fonte que ja popula faturamento_couvert).
--
-- Causa: gold.planejamento.couvert_vr_contahub existia mas o ETL
-- etl_gold_planejamento_full nunca populava (ficava 0 sempre).
--
-- Patch: 5 REPLACEs cirurgicos via DO block (idempotente):
--   1. Adicionar fase_couvert (SUM vd_vrcouvert por dia)
--   2. INSERT cols: incluir couvert_vr_contahub
--   3. SELECT VALUES: bind fc.couvert_vr
--   4. FROM/JOIN: LEFT JOIN fase_couvert fc USING (data_evento)
--   5. ON CONFLICT: incluir couvert_vr_contahub
--
-- Validacao Ord 24/04: 22.425,00; Deb 24/04: 2.568,00.
--
-- Bonus: front PlanejamentoClient.tsx inverte calculo da coluna couv/art
-- de (couvert/c_art*100) para (c_art/couvert*100) — % do couvert que paga
-- o c_art. couvertCArtGreen agora exige cArt/couvert <= meta (1.0).

DO $$
DECLARE v_def text; v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.proname='etl_gold_planejamento_full' AND n.nspname='public';

  v_new := v_def;

  -- Patch 1: fase_couvert (somar vd_vrcouvert do bronze por dia)
  v_new := REPLACE(v_new,
    E'  fase_eb AS (',
    E'  fase_couvert AS (\n    SELECT vd_dtgerencial::date AS data_evento, SUM(COALESCE(vd_vrcouvert, 0))::numeric(14,2) AS couvert_vr\n    FROM bronze.bronze_contahub_avendas_vendasperiodo\n    WHERE bar_id = p_bar_id\n      AND vd_dtgerencial::date BETWEEN p_data_inicio AND p_data_fim\n    GROUP BY vd_dtgerencial::date\n  ),\n  fase_eb AS ('
  );

  -- Patch 2: INSERT cols
  v_new := REPLACE(v_new,
    E'    fat_apos_22h, fat_apos_22h_percent,\n    percent_b,',
    E'    fat_apos_22h, fat_apos_22h_percent,\n    couvert_vr_contahub,\n    percent_b,'
  );

  -- Patch 3: SELECT VALUES
  v_new := REPLACE(v_new,
    E'    CASE WHEN fh.fat_total > 0 THEN (fh.fat_apos_22h / fh.fat_total * 100)::numeric(5,2) ELSE NULL END,\n    eb.eb_percent_b,',
    E'    CASE WHEN fh.fat_total > 0 THEN (fh.fat_apos_22h / fh.fat_total * 100)::numeric(5,2) ELSE NULL END,\n    COALESCE(fc.couvert_vr, 0),\n    eb.eb_percent_b,'
  );

  -- Patch 4: FROM/JOIN
  v_new := REPLACE(v_new,
    E'  LEFT JOIN fase_eb eb USING (data_evento)',
    E'  LEFT JOIN fase_eb eb USING (data_evento)\n  LEFT JOIN fase_couvert fc USING (data_evento)'
  );

  -- Patch 5: ON CONFLICT
  v_new := REPLACE(v_new,
    E'    fat_apos_22h_percent=EXCLUDED.fat_apos_22h_percent,\n    percent_b=EXCLUDED.percent_b,',
    E'    fat_apos_22h_percent=EXCLUDED.fat_apos_22h_percent,\n    couvert_vr_contahub=EXCLUDED.couvert_vr_contahub,\n    percent_b=EXCLUDED.percent_b,'
  );

  IF v_new <> v_def THEN
    EXECUTE v_new;
    RAISE NOTICE 'etl_gold_planejamento_full atualizado: couvert_vr_contahub';
  ELSE
    RAISE NOTICE 'etl_gold_planejamento_full ja esta atualizado (no-op)';
  END IF;
END $$;

-- Re-rodar ultimos 60 dias
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
