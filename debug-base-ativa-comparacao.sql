-- DEBUG: Comparar diferentes métodos de cálculo de base ativa

-- Método 1: Contagem simples (o que a view está fazendo)
WITH metodo1 AS (
  SELECT COUNT(DISTINCT cli_fone) as total
  FROM contahub_periodo
  WHERE bar_id = 3
    AND dt_gerencial >= '2025-12-31'::DATE  -- 90 dias antes de 31/03/2026
    AND dt_gerencial <= '2026-03-31'::DATE
    AND cli_fone IS NOT NULL
    AND LENGTH(cli_fone) >= 8
    AND cli_fone IN (
      SELECT cli_fone
      FROM contahub_periodo
      WHERE bar_id = 3
        AND dt_gerencial >= '2025-12-31'::DATE
        AND dt_gerencial <= '2026-03-31'::DATE
        AND cli_fone IS NOT NULL
        AND LENGTH(cli_fone) >= 8
      GROUP BY cli_fone
      HAVING COUNT(*) >= 2
    )
),
-- Método 2: Contagem de clientes com 2+ visitas (correto)
metodo2 AS (
  SELECT COUNT(*) as total
  FROM (
    SELECT cli_fone, COUNT(*) as visitas
    FROM contahub_periodo
    WHERE bar_id = 3
      AND dt_gerencial >= '2025-12-31'::DATE
      AND dt_gerencial <= '2026-03-31'::DATE
      AND cli_fone IS NOT NULL
      AND LENGTH(cli_fone) >= 8
    GROUP BY cli_fone
    HAVING COUNT(*) >= 2
  ) sub
),
-- Método 3: Total de clientes únicos (para comparação)
metodo3 AS (
  SELECT COUNT(DISTINCT cli_fone) as total
  FROM contahub_periodo
  WHERE bar_id = 3
    AND dt_gerencial >= '2025-12-31'::DATE
    AND dt_gerencial <= '2026-03-31'::DATE
    AND cli_fone IS NOT NULL
    AND LENGTH(cli_fone) >= 8
)
SELECT 
  m1.total as metodo1_view_atual,
  m2.total as metodo2_correto,
  m3.total as metodo3_total_clientes,
  ROUND((m2.total::NUMERIC / m3.total::NUMERIC) * 100, 2) as percentual_ativos
FROM metodo1 m1, metodo2 m2, metodo3 m3;
