-- =====================================================
-- FUNÇÃO HELPER: BRT para UTC (Cron Schedule)
-- =====================================================
-- Converte horário BRT para UTC para uso em pg_cron
-- BRT = UTC-3 (sem horário de verão)
-- =====================================================

CREATE OR REPLACE FUNCTION brt_to_utc_cron(
  hora_brt INTEGER,
  minuto_brt INTEGER DEFAULT 0
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  hora_utc INTEGER;
  minuto_utc INTEGER;
BEGIN
  -- Converter BRT para UTC (adicionar 3 horas)
  hora_utc := hora_brt + 3;
  minuto_utc := minuto_brt;
  
  -- Ajustar se passar de 24h
  IF hora_utc >= 24 THEN
    hora_utc := hora_utc - 24;
  END IF;
  
  -- Retornar no formato cron: 'minuto hora * * *'
  RETURN format('%s %s * * *', minuto_utc, hora_utc);
END;
$$;

-- =====================================================
-- EXEMPLOS DE USO:
-- =====================================================
-- SELECT brt_to_utc_cron(10, 15);  -- 10:15 BRT -> '15 13 * * *' (13:15 UTC)
-- SELECT brt_to_utc_cron(19, 0);   -- 19:00 BRT -> '0 22 * * *' (22:00 UTC)
-- SELECT brt_to_utc_cron(19, 5);   -- 19:05 BRT -> '5 22 * * *' (22:05 UTC)
-- SELECT brt_to_utc_cron(23, 30);  -- 23:30 BRT -> '30 2 * * *' (02:30 UTC do dia seguinte)

-- =====================================================
-- USAR EM CRON JOBS:
-- =====================================================
-- SELECT cron.schedule(
--   'meu-job',
--   brt_to_utc_cron(19, 0),  -- Roda às 19h BRT
--   $$ SELECT minha_funcao(); $$
-- );
