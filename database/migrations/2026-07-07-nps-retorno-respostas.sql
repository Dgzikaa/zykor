-- #2 — A resposta de NPS prediz retorno? Liga o telefone do Falae às visitas do cliente
-- (silver.cliente_visitas) e marca se a pessoa VOLTOU depois da data da visita avaliada.
-- GOTCHA: o telefone do Falae vem com DDI +55 (13 díg) e o cliente_fone_norm tem 11 → usa últimos 11.
CREATE OR REPLACE VIEW silver.nps_retorno_respostas AS
WITH resp AS (
  SELECT r.bar_id, r.falae_id, r.nps, r.client_phone, r.created_at::date AS data_resposta,
    COALESCE(
      r.data_visita,
      (SELECT (c->>'name')::date FROM jsonb_array_elements(COALESCE(r.criterios, r.raw_data->'criteria')) c
        WHERE (lower(c->>'nick') LIKE '%data da visita%' OR lower(c->>'nick') LIKE '%data do pedido%')
          AND c->>'name' ~ '^\d{4}-\d{2}-\d{2}$' LIMIT 1)
    ) AS data_visita
  FROM bronze.bronze_falae_respostas r
  WHERE r.nps IS NOT NULL
),
base AS (
  SELECT v.bar_id, v.falae_id, v.nps, v.data_visita, e.id AS evento_id,
    CASE WHEN length(regexp_replace(v.client_phone, '\D', '', 'g')) >= 11
      THEN right(regexp_replace(v.client_phone, '\D', '', 'g'), 11)
      ELSE public.normalizar_telefone_br(v.client_phone) END AS fone_norm,
    CASE WHEN v.nps >= 9 THEN 'promotor' WHEN v.nps >= 7 THEN 'neutro' ELSE 'detrator' END AS categoria
  FROM resp v
  JOIN operations.eventos_base e ON e.bar_id = v.bar_id AND e.data_evento = v.data_visita
  WHERE v.data_visita IS NOT NULL AND v.data_visita <= v.data_resposta AND v.data_visita >= v.data_resposta - 60
    AND v.client_phone IS NOT NULL AND length(regexp_replace(v.client_phone, '\D', '', 'g')) >= 10
)
SELECT b.bar_id, b.falae_id, b.evento_id, b.categoria, b.data_visita, b.fone_norm,
  EXISTS (
    SELECT 1 FROM silver.cliente_visitas cv
    WHERE cv.bar_id = b.bar_id AND cv.cliente_fone_norm = b.fone_norm AND cv.data_visita > b.data_visita
  ) AS voltou
FROM base b
WHERE b.fone_norm IS NOT NULL;

GRANT SELECT ON silver.nps_retorno_respostas TO service_role, authenticated;
