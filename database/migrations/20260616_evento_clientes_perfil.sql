-- 2026-06-16 — Fase 1 (Eventos): perfil de clientes do evento (novos x recorrentes
-- + taxa de retorno). Identidade = telefone normalizado. Fonte: silver.cliente_visitas.
CREATE OR REPLACE FUNCTION public.evento_clientes_perfil(p_bar_id integer, p_data date)
 RETURNS TABLE(
   total_identificados integer, novos integer, recorrentes integer,
   retornaram_30d integer, retornaram_60d integer, ticket_medio numeric
 )
 LANGUAGE sql STABLE
 SET search_path TO 'public', 'silver', 'pg_catalog'
AS $function$
  WITH dia AS (
    SELECT cliente_fone_norm, SUM(valor_consumo) AS consumo
    FROM silver.cliente_visitas
    WHERE bar_id = p_bar_id AND data_visita = p_data
      AND tem_telefone AND cliente_fone_norm IS NOT NULL AND cliente_fone_norm <> ''
    GROUP BY cliente_fone_norm
  ),
  enr AS (
    SELECT d.consumo,
      EXISTS (SELECT 1 FROM silver.cliente_visitas v WHERE v.bar_id=p_bar_id AND v.cliente_fone_norm=d.cliente_fone_norm AND v.data_visita < p_data) AS antes,
      EXISTS (SELECT 1 FROM silver.cliente_visitas v WHERE v.bar_id=p_bar_id AND v.cliente_fone_norm=d.cliente_fone_norm AND v.data_visita > p_data AND v.data_visita <= p_data + 30) AS volta30,
      EXISTS (SELECT 1 FROM silver.cliente_visitas v WHERE v.bar_id=p_bar_id AND v.cliente_fone_norm=d.cliente_fone_norm AND v.data_visita > p_data AND v.data_visita <= p_data + 60) AS volta60
    FROM dia d
  )
  SELECT count(*)::int, count(*) FILTER (WHERE NOT antes)::int, count(*) FILTER (WHERE antes)::int,
    count(*) FILTER (WHERE volta30)::int, count(*) FILTER (WHERE volta60)::int, ROUND(AVG(consumo)::numeric,2)
  FROM enr;
$function$;
GRANT EXECUTE ON FUNCTION public.evento_clientes_perfil(integer,date) TO authenticated, service_role, anon;

CREATE INDEX IF NOT EXISTS idx_cliente_visitas_bar_fone_data
ON silver.cliente_visitas (bar_id, cliente_fone_norm, data_visita)
WHERE tem_telefone AND cliente_fone_norm IS NOT NULL;
