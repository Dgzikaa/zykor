-- Investigar o cálculo de base ativa
-- Verificar quantos clientes têm 2+ visitas nos últimos 90 dias

WITH fim_trimestre AS (
  SELECT '2026-03-31'::DATE as data_fim
),
periodo_90d AS (
  SELECT 
    data_fim - INTERVAL '90 days' as data_inicio,
    data_fim
  FROM fim_trimestre
),
clientes_com_visitas AS (
  SELECT 
    cli_fone,
    COUNT(*) as total_visitas,
    MIN(dt_gerencial) as primeira_visita,
    MAX(dt_gerencial) as ultima_visita
  FROM contahub_periodo
  WHERE bar_id = 3
    AND dt_gerencial >= (SELECT data_inicio FROM periodo_90d)
    AND dt_gerencial <= (SELECT data_fim FROM periodo_90d)
    AND cli_fone IS NOT NULL
    AND LENGTH(cli_fone) >= 8
  GROUP BY cli_fone
)
SELECT 
  COUNT(*) FILTER (WHERE total_visitas >= 2) as clientes_ativos_2plus,
  COUNT(*) FILTER (WHERE total_visitas >= 1) as total_clientes,
  COUNT(*) FILTER (WHERE total_visitas = 1) as clientes_1_visita,
  COUNT(*) FILTER (WHERE total_visitas = 2) as clientes_2_visitas,
  COUNT(*) FILTER (WHERE total_visitas >= 3) as clientes_3plus_visitas,
  ROUND(AVG(total_visitas), 2) as media_visitas
FROM clientes_com_visitas;
