-- View que une: (1) matview gold.v_pipeline_health existente (edge functions)
--                (2) watchdog universal de data freshness por tabela bronze
-- Mantém o mesmo schema da matview pra o endpoint não precisar mudar.

CREATE OR REPLACE VIEW gold.v_pipeline_health_completo AS
SELECT
  camada::text,
  kind,
  job_name,
  bar_id,
  ultima_execucao,
  finished_at,
  duration_ms,
  status,
  records_affected,
  error_message,
  idade::text,
  health_color,
  descricao
FROM gold.v_pipeline_health
UNION ALL
SELECT
  'bronze'::text AS camada,
  'data_freshness'::text AS kind,
  f.pipeline_name AS job_name,
  f.bar_id,
  f.ultimo_em AS ultima_execucao,
  f.ultimo_em AS finished_at,
  NULL::bigint AS duration_ms,
  f.status,
  f.volume_24h AS records_affected,
  f.problema AS error_message,
  CASE
    WHEN f.horas_atras IS NULL THEN 'sem dados'
    WHEN f.horas_atras < 1 THEN round((f.horas_atras * 60)::numeric)::text || 'min atrás'
    WHEN f.horas_atras < 24 THEN round(f.horas_atras::numeric, 1)::text || 'h atrás'
    ELSE round((f.horas_atras / 24)::numeric, 1)::text || ' dias atrás'
  END AS idade,
  CASE f.status
    WHEN 'ok' THEN 'green'::text
    WHEN 'volume_baixo' THEN 'yellow'::text
    WHEN 'atrasado' THEN 'red'::text
    WHEN 'sem_dados' THEN 'gray'::text
    ELSE 'gray'::text
  END AS health_color,
  cfg.descricao
FROM public.verificar_data_freshness() f
LEFT JOIN system.data_freshness_config cfg ON cfg.pipeline_name = f.pipeline_name;

COMMENT ON VIEW gold.v_pipeline_health_completo IS
  'Saúde completa: matview gold.v_pipeline_health (edge functions com heartbeat) + watchdog universal data freshness por tabela bronze. Consumida por /operacional/saude-pipeline.';

CREATE OR REPLACE VIEW public.v_pipeline_health_completo AS
  SELECT * FROM gold.v_pipeline_health_completo;
