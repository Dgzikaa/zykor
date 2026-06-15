-- 2026-06-15 — Mix consolidado (ContaHub + Yuzer) por dia para o planejamento-comercial.
--
-- Bug: em dias dominados por Yuzer (ex: 13/06 Copa), gold.planejamento.percent_b/c/d
-- vinham 0, pois o mix do gold (via calculate_evento_metrics) e' so do ContaHub e
-- nesses dias o ContaHub fica ~zero. O /analitico/eventos ja consolidava via
-- evento_cesta_detalhe; aqui exponho a MESMA logica por periodo p/ o planejamento
-- fazer overlay so nos dias com mix zerado (dias normais ficam intactos).
CREATE OR REPLACE FUNCTION public.get_mix_consolidado_periodo(p_bar_id integer, p_ini date, p_fim date)
 RETURNS TABLE(data_evento date, percent_b numeric, percent_c numeric, percent_d numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'operations', 'bronze', 'silver', 'gold', 'pg_catalog'
AS $function$
  SELECT d.data_evento,
    ROUND(100.0 * COALESCE(SUM(c.valor) FILTER (WHERE c.categoria = 'bebida'), 0)
          / NULLIF(SUM(c.valor) FILTER (WHERE c.categoria IN ('comida','bebida','drink')), 0), 2) AS percent_b,
    ROUND(100.0 * COALESCE(SUM(c.valor) FILTER (WHERE c.categoria = 'comida'), 0)
          / NULLIF(SUM(c.valor) FILTER (WHERE c.categoria IN ('comida','bebida','drink')), 0), 2) AS percent_c,
    ROUND(100.0 * COALESCE(SUM(c.valor) FILTER (WHERE c.categoria = 'drink'), 0)
          / NULLIF(SUM(c.valor) FILTER (WHERE c.categoria IN ('comida','bebida','drink')), 0), 2) AS percent_d
  FROM (
    SELECT DISTINCT data_evento
    FROM gold.planejamento
    WHERE bar_id = p_bar_id AND data_evento BETWEEN p_ini AND p_fim
  ) d
  CROSS JOIN LATERAL public.evento_cesta_detalhe(p_bar_id, d.data_evento) c
  GROUP BY d.data_evento;
$function$;
GRANT EXECUTE ON FUNCTION public.get_mix_consolidado_periodo(integer,date,date) TO authenticated, service_role, anon;
