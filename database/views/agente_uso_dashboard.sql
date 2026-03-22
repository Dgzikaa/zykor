-- View: agente_uso_dashboard
CREATE OR REPLACE VIEW public.agente_uso_dashboard AS
 SELECT date(created_at) AS data, agent_name, count(*) AS total_queries, count(CASE WHEN success THEN 1 ELSE NULL END) AS queries_sucesso, round(avg(response_time_ms), 0) AS tempo_medio_ms, round(avg(tokens_used), 0) AS tokens_medio, count(CASE WHEN cache_hit THEN 1 ELSE NULL END) AS cache_hits, round(avg(feedback_rating), 2) AS rating_medio, count(CASE WHEN (feedback_rating IS NOT NULL) THEN 1 ELSE NULL END) AS total_feedbacks
   FROM agente_uso WHERE (created_at >= (now() - '30 days'::interval)) GROUP BY (date(created_at)), agent_name ORDER BY (date(created_at)) DESC, agent_name;
