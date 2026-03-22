-- Adicionar colunas de tempo limite em bar_regras_negocio
ALTER TABLE bar_regras_negocio 
ADD COLUMN IF NOT EXISTS tempo_limite_bar_segundos INTEGER DEFAULT 600,
ADD COLUMN IF NOT EXISTS tempo_limite_cozinha_segundos INTEGER DEFAULT 1200;

COMMENT ON COLUMN bar_regras_negocio.tempo_limite_bar_segundos IS 'Limite de tempo em segundos para considerar atraso no bar (default 600 = 10 min)';
COMMENT ON COLUMN bar_regras_negocio.tempo_limite_cozinha_segundos IS 'Limite de tempo em segundos para considerar atraso na cozinha (default 1200 = 20 min)';