-- #5 — Aquisição/fidelização por atração: cliente cuja PRIMEIRA visita ao bar foi na noite do evento,
-- e se virou recorrente (total_visitas >= 2). Credita ao evento da 1ª visita → rollup por artista/label.
CREATE OR REPLACE VIEW silver.cliente_aquisicao AS
WITH prim AS (
  SELECT bar_id, cliente_fone_norm,
    min(data_visita) AS primeira,
    count(DISTINCT data_visita) AS total_visitas
  FROM silver.cliente_visitas
  WHERE tem_telefone = true AND cliente_fone_norm IS NOT NULL AND cliente_fone_norm <> ''
  GROUP BY bar_id, cliente_fone_norm
)
SELECT p.bar_id, p.cliente_fone_norm, p.primeira, p.total_visitas,
  (p.total_visitas >= 2) AS fidelizado,
  e.id AS evento_id
FROM prim p
JOIN operations.eventos_base e ON e.bar_id = p.bar_id AND e.data_evento = p.primeira;

GRANT SELECT ON silver.cliente_aquisicao TO service_role, authenticated;

-- Agregação por evento (usada pelo ranking de artistas: novos + fidelizados na janela).
CREATE OR REPLACE FUNCTION operations.fn_aquisicao_por_evento(p_bar integer, p_ini date, p_fim date)
RETURNS TABLE(evento_id bigint, novos bigint, fidelizados bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'operations', 'silver', 'public', 'pg_catalog'
AS $$
  SELECT evento_id, count(*)::bigint, count(*) FILTER (WHERE fidelizado)::bigint
  FROM silver.cliente_aquisicao
  WHERE bar_id = p_bar AND primeira >= p_ini AND primeira <= p_fim
  GROUP BY evento_id;
$$;
REVOKE ALL ON FUNCTION operations.fn_aquisicao_por_evento(integer, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION operations.fn_aquisicao_por_evento(integer, date, date) TO service_role, authenticated;
