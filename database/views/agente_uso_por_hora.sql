-- View: agente_uso_por_hora
CREATE OR REPLACE VIEW public.agente_uso_por_hora AS
 SELECT date_trunc('hour', created_at) AS hora, count(*) AS queries, round(avg(response_time_ms), 0) AS tempo_medio, count(CASE WHEN cache_hit THEN 1 ELSE NULL END) AS cache_hits
   FROM agente_uso WHERE (created_at >= (now() - '24:00:00'::interval)) GROUP BY (date_trunc('hour', created_at)) ORDER BY (date_trunc('hour', created_at)) DESC;
