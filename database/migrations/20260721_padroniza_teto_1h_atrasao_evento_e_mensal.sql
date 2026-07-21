-- 2026-07-21: Padroniza o teto de outlier (>1h = 3600s) na CONTAGEM de atrasao.
-- ============================================================================
-- Contexto (pergunta do socio): nos tempos de saida / atraso, estavamos
-- descartando outliers (>1h) tanto da media quanto da contagem de atraso, ou
-- so da media?
--
-- Diagnostico: a MEDIA e o DENOMINADOR (qtd_*_total) ja descartavam >3600s em
-- todos os motores. Mas a CONTAGEM de atrasao contava tudo acima do limite
-- (>1200 cozinha / >600 bar) SEM teto superior em dois motores:
--   - public.calculate_evento_metrics  (por evento -> operations.eventos_base)
--   - public.etl_gold_desempenho_mensal (mensal   -> gold.desempenho)
-- Isso incluia pedidos abertos/cancelados/nunca baixados de varias horas como
-- "atrasao", e inflava o % de atraso duas vezes (numerador incluia itens que o
-- denominador ja excluia). O ETL semanal (v4) ja fazia certo (teto <= 3600).
--
-- Fix: adiciona AND <= 3600 nas linhas de atrasao, igualando ao semanal.
--   calculate_evento_metrics   v32 -> v33
--   etl_gold_desempenho_mensal v13 -> v14
--
-- Aplicado em prod via replace() sobre pg_get_functiondef (cirurgico, sem
-- reescrever o corpo). Reproducao abaixo. Idempotente-ish: se as ancoras nao
-- casarem (def ja alterada), levanta excecao em vez de aplicar errado.
-- ============================================================================

DO $mig$
DECLARE
  v_def text;
BEGIN
  -- 1) calculate_evento_metrics (por evento -> operations.eventos_base)
  SELECT pg_get_functiondef('public.calculate_evento_metrics(integer)'::regprocedure) INTO v_def;

  v_def := replace(v_def,
    'WHERE tempo > 1200) AS atrasao_cozinha',
    'WHERE tempo > 1200 AND tempo <= 3600) AS atrasao_cozinha');
  v_def := replace(v_def,
    'WHERE tempo > 600 ) AS atrasao_bar',
    'WHERE tempo > 600 AND tempo <= 3600 ) AS atrasao_bar');
  v_def := replace(v_def, 'versao_calculo = 32', 'versao_calculo = 33');

  IF v_def NOT LIKE '%tempo > 1200 AND tempo <= 3600%' OR v_def NOT LIKE '%versao_calculo = 33%' THEN
    RAISE EXCEPTION 'calculate_evento_metrics: ancoras de atrasao nao casaram (def mudou?)';
  END IF;
  EXECUTE v_def;

  -- 2) etl_gold_desempenho_mensal (mensal -> gold.desempenho)
  SELECT pg_get_functiondef('public.etl_gold_desempenho_mensal(integer,integer,integer)'::regprocedure) INTO v_def;

  v_def := replace(v_def,
    'tempo_bar_efetivo > 600)::integer as atrasao_drinks',
    'tempo_bar_efetivo > 600 AND tempo_bar_efetivo <= 3600)::integer as atrasao_drinks');
  v_def := replace(v_def,
    'tempo_coz_efetivo > 1200)::integer as atrasao_cozinha',
    'tempo_coz_efetivo > 1200 AND tempo_coz_efetivo <= 3600)::integer as atrasao_cozinha');
  v_def := replace(v_def,
    'tempo_bar_efetivo > 600)::integer as atrasao_bar',
    'tempo_bar_efetivo > 600 AND tempo_bar_efetivo <= 3600)::integer as atrasao_bar');
  v_def := replace(v_def, 'NOW(), 13', 'NOW(), 14');
  v_def := replace(v_def, 'versao_etl=13;', 'versao_etl=14;');

  IF v_def NOT LIKE '%tempo_coz_efetivo > 1200 AND tempo_coz_efetivo <= 3600%'
     OR v_def NOT LIKE '%tempo_bar_efetivo > 600 AND tempo_bar_efetivo <= 3600%'
     OR v_def NOT LIKE '%versao_etl=14;%' THEN
    RAISE EXCEPTION 'etl_gold_desempenho_mensal: ancoras de atrasao nao casaram (def mudou?)';
  END IF;
  EXECUTE v_def;
END $mig$;
