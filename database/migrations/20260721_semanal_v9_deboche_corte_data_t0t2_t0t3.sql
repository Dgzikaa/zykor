-- 2026-07-21 (double-check, parte 3): semanal passa a aplicar o corte de data
-- t0_t2 -> t0_t3 do Deboche, igual ao mensal e ao calculate_evento_metrics.
-- ============================================================================
-- Antes: o semanal usava um boolean (v_uses_t0t2_cozinha) -> Deboche sempre t0_t3.
-- Isso divergia do mensal/evento no Deboche ANTES de marco/2026, quando a regra
-- (confirmada com o socio) era t0_t2. Validacao: Deboche cozinha fev/2026 mostrava
-- ~1241s (t0_t3) no semanal vs ~574s (t0_t2) real -> agora mostra ~569s (t0_t2).
--
-- Regra (espelha etl_gold_desempenho_mensal / calculate_evento_metrics):
--   Ord (bar 3): cozinha t0_t2 sempre (cut '9999-12-31'), bar t0_t3 sempre (cut '1900-01-01').
--   Deb (bar 4): cozinha t0_t2 ate 19/03/2026, t0_t3 de 20/03 (cut '2026-03-20');
--                bar     t0_t2 ate 06/03/2026, t0_t3 de 07/03 (cut '2026-03-07').
--
-- Troca o boolean por v_cut_coz/v_cut_bar e reescreve o CTE de tempos com
-- tempo_coz_efetivo / tempo_bar_efetivo (com teto <= 3600 ja aplicado na v8).
-- v8 -> v9. Aplicado via replace() sobre pg_get_functiondef; guardas abortam se
-- alguma ancora nao casar. Reprocessado: semanal 2025+2026.
-- ============================================================================

DO $mig$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.etl_gold_desempenho_semanal(integer,integer,integer)'::regprocedure) INTO v_def;

  -- (a) declaracao: troca boolean por dois cutoffs
  v_def := replace(v_def, '  v_uses_t0t2_cozinha boolean;', '  v_cut_coz date;'||chr(10)||'  v_cut_bar date;');

  -- (b) config por bar
  v_def := replace(v_def, '    v_uses_t0t2_cozinha := true;',
    '    v_cut_coz := DATE ''9999-12-31'';'||chr(10)||'    v_cut_bar := DATE ''1900-01-01'';');
  v_def := replace(v_def, '    v_uses_t0t2_cozinha := false;'||chr(10)||'  ELSE',
    '    v_cut_coz := DATE ''2026-03-20'';'||chr(10)||'    v_cut_bar := DATE ''2026-03-07'';'||chr(10)||'  ELSE');
  v_def := replace(v_def, '    v_uses_t0t2_cozinha := false;'||chr(10)||'  END IF;',
    '    v_cut_coz := DATE ''9999-12-31'';'||chr(10)||'    v_cut_bar := DATE ''9999-12-31'';'||chr(10)||'  END IF;');

  -- (c) reescreve o CTE de tempos (boolean -> coluna efetiva por data)
  v_def := replace(v_def,
$old$-- FIX 2026-04-29 v7: Por loc_desc + coluna especifica por bar (espelha Excel)
  -- Ord: drinks=t0_t3 estacoes; cozinha=t0_t2 Cozinha 1+2
  -- Deb: drinks=t0_t3 Bar; cozinha=t0_t3 Cozinha+Cozinha 2
  fase_tempos_agg AS (
    SELECT
      -- DRINKS sempre t0_t3, filtrado por v_locs_drinks
      CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600) > 0
        THEN AVG(t0_t3) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600)::numeric(8,2) END as tempo_drinks,
      -- BEBIDAS: mantem categoria='bebida' do silver pra metricas internas
      CASE WHEN COUNT(*) FILTER (WHERE categoria = 'bebida' AND t0_t3 BETWEEN 1 AND 3600) > 0
        THEN AVG(t0_t3) FILTER (WHERE categoria = 'bebida' AND t0_t3 BETWEEN 1 AND 3600)::numeric(8,2) END as tempo_bebidas,
      -- COZINHA: t0_t2 (Ord) ou t0_t3 (Deb)
      CASE WHEN v_uses_t0t2_cozinha THEN
        CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 1 AND 3600) > 0
          THEN AVG(t0_t2) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 1 AND 3600)::numeric(8,2) END
      ELSE
        CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 1 AND 3600) > 0
          THEN AVG(t0_t3) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 1 AND 3600)::numeric(8,2) END
      END as tempo_cozinha,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 1 AND 3600)::integer as qtd_drinks_total,
      CASE WHEN v_uses_t0t2_cozinha THEN
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 1 AND 3600)::integer
      ELSE
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 1 AND 3600)::integer
      END as qtd_comida_total,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 BETWEEN 300 AND 600)::integer as atrasinho_drinks,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 > 600 AND t0_t3 <= 3600)::integer as atrasao_drinks,
      CASE WHEN v_uses_t0t2_cozinha THEN
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 BETWEEN 900 AND 1200)::integer
      ELSE
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 BETWEEN 900 AND 1200)::integer
      END as atrasinho_cozinha,
      CASE WHEN v_uses_t0t2_cozinha THEN
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t2 > 1200 AND t0_t2 <= 3600)::integer
      ELSE
        COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND t0_t3 > 1200 AND t0_t3 <= 3600)::integer
      END as atrasao_cozinha,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND t0_t3 > 600 AND t0_t3 <= 3600)::integer as atrasao_bar
    FROM silver.tempos_producao WHERE bar_id = p_bar_id AND data_producao BETWEEN v_data_inicio AND v_data_fim
  ),$old$,
$new$-- v9: coluna efetiva por data (t0_t2->t0_t3 na virada do Deboche), espelha o mensal.
  --   Ord: cozinha t0_t2 sempre, bar t0_t3 sempre. Deb: t0_t2 ate a virada, t0_t3 depois.
  tempos_efetivos AS (
    SELECT local_desc, categoria, data_producao,
      CASE WHEN data_producao >= v_cut_coz THEN t0_t3 ELSE t0_t2 END AS tempo_coz_efetivo,
      CASE WHEN data_producao >= v_cut_bar THEN t0_t3 ELSE t0_t2 END AS tempo_bar_efetivo
    FROM silver.tempos_producao
    WHERE bar_id = p_bar_id AND data_producao BETWEEN v_data_inicio AND v_data_fim
  ),
  fase_tempos_agg AS (
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND tempo_bar_efetivo BETWEEN 1 AND 3600) > 0
        THEN AVG(tempo_bar_efetivo) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND tempo_bar_efetivo BETWEEN 1 AND 3600)::numeric(8,2) END as tempo_drinks,
      CASE WHEN COUNT(*) FILTER (WHERE categoria = 'bebida' AND tempo_bar_efetivo BETWEEN 1 AND 3600) > 0
        THEN AVG(tempo_bar_efetivo) FILTER (WHERE categoria = 'bebida' AND tempo_bar_efetivo BETWEEN 1 AND 3600)::numeric(8,2) END as tempo_bebidas,
      CASE WHEN COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND tempo_coz_efetivo BETWEEN 1 AND 3600) > 0
        THEN AVG(tempo_coz_efetivo) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND tempo_coz_efetivo BETWEEN 1 AND 3600)::numeric(8,2) END as tempo_cozinha,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND tempo_bar_efetivo BETWEEN 1 AND 3600)::integer as qtd_drinks_total,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND tempo_coz_efetivo BETWEEN 1 AND 3600)::integer as qtd_comida_total,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND tempo_bar_efetivo BETWEEN 300 AND 600)::integer as atrasinho_drinks,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND tempo_bar_efetivo > 600 AND tempo_bar_efetivo <= 3600)::integer as atrasao_drinks,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND tempo_coz_efetivo BETWEEN 900 AND 1200)::integer as atrasinho_cozinha,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_cozinha) AND tempo_coz_efetivo > 1200 AND tempo_coz_efetivo <= 3600)::integer as atrasao_cozinha,
      COUNT(*) FILTER (WHERE local_desc = ANY(v_locs_drinks) AND tempo_bar_efetivo > 600 AND tempo_bar_efetivo <= 3600)::integer as atrasao_bar
    FROM tempos_efetivos
  ),$new$);

  -- (d) versao
  v_def := replace(v_def, 'NOW(), 8', 'NOW(), 9');
  v_def := replace(v_def, 'versao_etl = 8;', 'versao_etl = 9;');

  -- guardas
  IF position('v_uses_t0t2_cozinha' in v_def) > 0 THEN
    RAISE EXCEPTION 'semanal v9: ainda restou referencia a v_uses_t0t2_cozinha (algum replace nao casou)';
  END IF;
  IF v_def NOT LIKE '%tempos_efetivos AS (%'
     OR v_def NOT LIKE '%CASE WHEN data_producao >= v_cut_coz THEN t0_t3 ELSE t0_t2 END AS tempo_coz_efetivo%'
     OR v_def NOT LIKE '%v_cut_coz := DATE ''2026-03-20''%'
     OR v_def NOT LIKE '%versao_etl = 9;%' THEN
    RAISE EXCEPTION 'semanal v9: ancoras esperadas ausentes (def divergiu)';
  END IF;

  EXECUTE v_def;
END $mig$;
