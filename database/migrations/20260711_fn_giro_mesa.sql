-- Giro de mesa (eficiência de receita): a partir de silver.cliente_visitas
-- (tempo_estadia_minutos, valor_pagamentos, hora_chegada). R$/mesa-hora = receita ÷ horas-mesa
-- ocupadas, ticket, permanência média, receita por hora e por faixa de permanência.
-- NOTA: métricas "por mesa" foram OMITIDAS — mesa_desc tem milhares de valores (não é mesa
-- física estável), então giro/ranking por mesa seria enganoso. Cap de outlier no tempo (10..480).
-- Consumido por /api/relatorios/giro-mesa (aba "Giro / Receita" em /relatorios/tempo-estadia).
CREATE OR REPLACE FUNCTION operations.fn_giro_mesa(
  p_bar_id int,
  p_dias   int DEFAULT 90
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO operations, silver, public, pg_catalog
AS $$
  WITH base AS (
    SELECT tempo_estadia_minutos AS t, valor_pagamentos AS receita, hora_chegada AS hora
    FROM silver.cliente_visitas
    WHERE bar_id = p_bar_id AND data_visita >= CURRENT_DATE - p_dias
      AND tempo_estadia_minutos BETWEEN 10 AND 480
      AND valor_pagamentos > 0
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
        'visitas', count(*),
        'receita_total', round(sum(receita),0),
        'tempo_medio_min', round(avg(t)::numeric,0),
        'ticket_medio', round((sum(receita)/NULLIF(count(*),0))::numeric,0),
        'rs_por_mesa_hora', round((sum(receita)/NULLIF(sum(t)/60.0,0))::numeric,0)
      ) FROM base),
    'por_hora', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.hora),'[]'::jsonb) FROM (
        SELECT hora, count(*) AS visitas, round(sum(receita),0) AS receita,
               round(avg(t)::numeric,0) AS tempo_medio,
               round((sum(receita)/NULLIF(count(*),0))::numeric,0) AS ticket
        FROM base WHERE hora IS NOT NULL GROUP BY hora) x),
    'por_faixa', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.ord),'[]'::jsonb) FROM (
        SELECT CASE WHEN t < 60 THEN '< 1h' WHEN t < 120 THEN '1–2h' WHEN t < 180 THEN '2–3h'
                    WHEN t < 240 THEN '3–4h' ELSE '4h+' END AS faixa,
               CASE WHEN t < 60 THEN 1 WHEN t < 120 THEN 2 WHEN t < 180 THEN 3 WHEN t < 240 THEN 4 ELSE 5 END AS ord,
               count(*) AS visitas, round((sum(receita)/NULLIF(count(*),0))::numeric,0) AS ticket,
               round(sum(receita),0) AS receita
        FROM base GROUP BY 1,2) x),
    'meta', jsonb_build_object('dias',p_dias)
  );
$$;

REVOKE ALL ON FUNCTION operations.fn_giro_mesa(int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_giro_mesa(int,int) TO service_role;
