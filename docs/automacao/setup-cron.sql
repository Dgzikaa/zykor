-- SETUP AGENTE DIÁRIO
CREATE TABLE IF NOT EXISTS relatorios_diarios (
  id BIGSERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL,
  data_referencia DATE NOT NULL,
  score_saude NUMERIC(5,2),
  problemas JSONB DEFAULT '[]'::jsonb,
  alertas JSONB DEFAULT '[]'::jsonb,
  faturamento NUMERIC(12,2),
  publico INTEGER,
  executado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bar_id, data_referencia)
);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

CREATE OR REPLACE FUNCTION executar_agente_diario()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM http_get('https://zykor.vercel.app/api/exploracao/agente-diario?secret=SEU_SECRET');
END;
$$;

SELECT cron.schedule('agente-diario', '0 9 * * *', $$SELECT executar_agente_diario();$$);
