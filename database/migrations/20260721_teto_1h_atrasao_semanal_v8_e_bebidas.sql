-- 2026-07-21 (double-check): fecha brechas de teto de outlier que sobraram.
-- ============================================================================
-- Apos padronizar evento(v33)/mensal(v14), a comparacao linha-a-linha das 3
-- funcoes que gravam gold.desempenho revelou:
--
--   1) SEMANAL: regressao silenciosa. A v4 (abr) tinha o teto <= 3600 no
--      atrasao; a reescrita para v7 (por loc_desc) REMOVEU o teto. Media e
--      denominador seguiam com teto, mas o atrasao contava >600/>1200 sem
--      limite -> mesmo bug do mensal/evento, inclusive % de atraso distorcido.
--      Reaplica o teto. v7 -> v8.
--
--   2) tempo_bebidas (media interna) usava t0_t3 > 0 SEM teto em semanal E
--      mensal. Padroniza p/ BETWEEN 1 AND 3600 (igual drinks/cozinha).
--      mensal v14 -> v15.
--
-- Aplicado em prod via replace() sobre pg_get_functiondef (cirurgico).
-- Reprocessado: semanal 2025+2026 e mensal 2025+2026.
--
-- PENDENTE (nao coberto aqui - definicao de metrica, decisao do socio):
--   - Semanal NAO aplica o corte de data t0_t2->t0_t3 do Deboche (usa t0_t3
--     sempre); mensal/evento aplicam (cozinha 20/03, bar 07/03/2026). Diverge
--     no Deboche pre-marco/2026.
-- ============================================================================

DO $mig$
DECLARE v_def text;
BEGIN
  -- 1) SEMANAL v7 -> v8
  SELECT pg_get_functiondef('public.etl_gold_desempenho_semanal(integer,integer,integer)'::regprocedure) INTO v_def;
  v_def := replace(v_def, 'AND t0_t3 > 600)::integer as atrasao_drinks',
                          'AND t0_t3 > 600 AND t0_t3 <= 3600)::integer as atrasao_drinks');
  v_def := replace(v_def, 'AND t0_t3 > 600)::integer as atrasao_bar',
                          'AND t0_t3 > 600 AND t0_t3 <= 3600)::integer as atrasao_bar');
  v_def := replace(v_def, 'AND t0_t2 > 1200)::integer',
                          'AND t0_t2 > 1200 AND t0_t2 <= 3600)::integer');
  v_def := replace(v_def, 'AND t0_t3 > 1200)::integer',
                          'AND t0_t3 > 1200 AND t0_t3 <= 3600)::integer');
  v_def := replace(v_def, 'categoria = ''bebida'' AND t0_t3 > 0',
                          'categoria = ''bebida'' AND t0_t3 BETWEEN 1 AND 3600');
  v_def := replace(v_def, 'NOW(), 7', 'NOW(), 8');
  v_def := replace(v_def, 'versao_etl = 7;', 'versao_etl = 8;');
  IF v_def NOT LIKE '%t0_t3 > 600 AND t0_t3 <= 3600)::integer as atrasao_drinks%'
     OR v_def NOT LIKE '%t0_t2 > 1200 AND t0_t2 <= 3600%'
     OR v_def NOT LIKE '%t0_t3 > 1200 AND t0_t3 <= 3600%'
     OR v_def LIKE '%categoria = ''bebida'' AND t0_t3 > 0%'
     OR v_def NOT LIKE '%versao_etl = 8;%' THEN
    RAISE EXCEPTION 'semanal: ancoras nao casaram (def mudou?)';
  END IF;
  EXECUTE v_def;

  -- 2) MENSAL v14 -> v15 (so tempo_bebidas)
  SELECT pg_get_functiondef('public.etl_gold_desempenho_mensal(integer,integer,integer)'::regprocedure) INTO v_def;
  v_def := replace(v_def, 'categoria = ''bebida'' AND tempo_bar_efetivo > 0',
                          'categoria = ''bebida'' AND tempo_bar_efetivo BETWEEN 1 AND 3600');
  v_def := replace(v_def, 'NOW(), 14', 'NOW(), 15');
  v_def := replace(v_def, 'versao_etl=14;', 'versao_etl=15;');
  IF v_def LIKE '%tempo_bar_efetivo > 0) > 0%' OR v_def NOT LIKE '%versao_etl=15;%' THEN
    RAISE EXCEPTION 'mensal: ancoras nao casaram (def mudou?)';
  END IF;
  EXECUTE v_def;
END $mig$;
