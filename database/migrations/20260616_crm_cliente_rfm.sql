-- 2026-06-16 — Fase 2: Cliente 360 / RFM.
-- Matview crm.cliente_rfm (por telefone): Recência, Frequência, Monetário + segmento.
DROP MATERIALIZED VIEW IF EXISTS crm.cliente_rfm;
CREATE MATERIALIZED VIEW crm.cliente_rfm AS
WITH base AS (
  SELECT bar_id, cliente_fone_norm,
    max(cliente_nome) FILTER (WHERE cliente_nome IS NOT NULL AND cliente_nome <> '') AS cliente_nome,
    min(data_visita) AS primeira_visita, max(data_visita) AS ultima_visita,
    count(DISTINCT data_visita) AS frequencia,
    ROUND(COALESCE(SUM(valor_consumo),0)::numeric,2) AS monetario,
    ROUND(AVG(NULLIF(valor_consumo,0))::numeric,2) AS ticket_medio
  FROM silver.cliente_visitas
  WHERE tem_telefone AND cliente_fone_norm IS NOT NULL AND cliente_fone_norm <> ''
  GROUP BY bar_id, cliente_fone_norm
)
SELECT b.*, (CURRENT_DATE - b.ultima_visita) AS recencia_dias, (CURRENT_DATE - b.primeira_visita) AS idade_dias,
  CASE
    WHEN (CURRENT_DATE - b.ultima_visita) <= 30 AND b.frequencia >= 5 THEN 'Campeões'
    WHEN (CURRENT_DATE - b.ultima_visita) <= 60 AND b.frequencia >= 3 THEN 'Leais'
    WHEN b.frequencia = 1 AND (CURRENT_DATE - b.ultima_visita) <= 30 THEN 'Novos'
    WHEN b.frequencia <= 2 AND (CURRENT_DATE - b.ultima_visita) <= 60 THEN 'Promissores'
    WHEN b.frequencia >= 3 AND (CURRENT_DATE - b.ultima_visita) BETWEEN 61 AND 180 THEN 'Em risco'
    WHEN (CURRENT_DATE - b.ultima_visita) BETWEEN 61 AND 180 THEN 'Hibernando'
    ELSE 'Perdidos'
  END AS segmento
FROM base b;
CREATE UNIQUE INDEX idx_cliente_rfm_pk ON crm.cliente_rfm (bar_id, cliente_fone_norm);
CREATE INDEX idx_cliente_rfm_seg ON crm.cliente_rfm (bar_id, segmento);
CREATE INDEX idx_cliente_rfm_mon ON crm.cliente_rfm (bar_id, monetario DESC);
GRANT SELECT ON crm.cliente_rfm TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION crm.refresh_cliente_rfm() RETURNS void LANGUAGE plpgsql
 SET search_path TO 'crm','silver','pg_catalog'
AS $function$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY crm.cliente_rfm; END; $function$;

CREATE OR REPLACE FUNCTION public.get_rfm_resumo(p_bar_id integer)
 RETURNS TABLE(segmento text, clientes integer, valor_total numeric, ticket_medio numeric, recencia_media numeric, frequencia_media numeric)
 LANGUAGE sql STABLE SET search_path TO 'public','crm','pg_catalog'
AS $function$
  SELECT segmento, count(*)::int, ROUND(SUM(monetario)::numeric,0), ROUND(AVG(ticket_medio)::numeric,2),
    ROUND(AVG(recencia_dias)::numeric,0), ROUND(AVG(frequencia)::numeric,1)
  FROM crm.cliente_rfm WHERE bar_id = p_bar_id GROUP BY segmento;
$function$;
GRANT EXECUTE ON FUNCTION public.get_rfm_resumo(integer) TO authenticated, service_role, anon;

-- Refresh diário 06:30 BRT:
-- SELECT cron.schedule('refresh-crm-cliente-rfm','30 9 * * *', $$ SELECT crm.refresh_cliente_rfm(); $$);
