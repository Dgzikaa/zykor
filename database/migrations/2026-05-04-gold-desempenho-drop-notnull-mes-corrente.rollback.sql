-- Rollback 2026-05-04-gold-desempenho-drop-notnull-mes-corrente.sql
--
-- ATENCAO: rollback so funciona se TODAS as linhas tiverem valores nao-nulos
-- nos 4 campos. Mes corrente pode ter NULLs — rodar SELECT antes:
--   SELECT periodo, COUNT(*) FILTER (WHERE cmv IS NULL) cmv_null,
--          COUNT(*) FILTER (WHERE cmv_limpo IS NULL) cmv_limpo_null
--   FROM gold.desempenho GROUP BY periodo ORDER BY periodo DESC LIMIT 5;

ALTER TABLE gold.desempenho ALTER COLUMN cmv_percentual SET NOT NULL;
ALTER TABLE gold.desempenho ALTER COLUMN cmv_limpo SET NOT NULL;
ALTER TABLE gold.desempenho ALTER COLUMN cmv SET NOT NULL;
ALTER TABLE gold.desempenho ALTER COLUMN faturamento_cmvivel SET NOT NULL;
