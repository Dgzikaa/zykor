-- 2026-05-04: gold.desempenho — DROP NOT NULL nos 4 campos derivados de CMV
-- pra permitir mes corrente entrar no gold antes do CMV ser fechado.
--
-- Contexto: cron `gold-desempenho` (12 UTC diario) chama
-- etl_gold_desempenho_all_bars(14) → etl_gold_desempenho_mensal_range
-- pra cada bar. O ETL falhava silenciosamente em mes corrente (maio/2026)
-- porque CMV ainda nao tem valor (planilha CMV semanal so fecha quando
-- a semana acaba), e os 4 campos abaixo eram NOT NULL.
--
-- Resultado: dashboard mensal so mostrava ate abril. Sem aviso.
--
-- Fix: relaxar NOT NULL — campos passam a aceitar NULL pra mes incompleto.
-- O front ja tem fallback (toNum() retorna null) e exibe '—' nesses casos.

ALTER TABLE gold.desempenho ALTER COLUMN faturamento_cmvivel DROP NOT NULL;
ALTER TABLE gold.desempenho ALTER COLUMN cmv DROP NOT NULL;
ALTER TABLE gold.desempenho ALTER COLUMN cmv_limpo DROP NOT NULL;
ALTER TABLE gold.desempenho ALTER COLUMN cmv_percentual DROP NOT NULL;
