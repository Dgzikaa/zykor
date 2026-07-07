-- Notas por SUB-CRITÉRIO (ratings) do Falae, vinculadas ao evento da noite (bar+data da visita).
-- O Falae coleta Atendimento/Comida/Música/Tempo de espera/Custo-benefício/etc. em cada resposta
-- (dentro de criterios[].type='Rating'); ninguém analisava. A canonicalização dos rótulos (que
-- variam muito entre bares/pesquisas) é feita no route (TS, lib nps-dimensoes). Mesmo guarda-corpo.
CREATE OR REPLACE VIEW silver.nps_criterio_evento AS
WITH resp AS (
  SELECT r.bar_id, r.falae_id, r.criterios, r.raw_data, r.created_at::date AS data_resposta,
    COALESCE(
      r.data_visita,
      (SELECT (c->>'name')::date FROM jsonb_array_elements(COALESCE(r.criterios, r.raw_data->'criteria')) c
        WHERE (lower(c->>'nick') LIKE '%data da visita%' OR lower(c->>'nick') LIKE '%data do pedido%')
          AND c->>'name' ~ '^\d{4}-\d{2}-\d{2}$' LIMIT 1)
    ) AS data_visita
  FROM bronze.bronze_falae_respostas r
),
crit AS (
  SELECT resp.bar_id, resp.falae_id, resp.data_visita, resp.data_resposta,
    (c->>'nick') AS criterio_raw,
    NULLIF(regexp_replace(c->>'name', '\D', '', 'g'), '')::int AS nota
  FROM resp, jsonb_array_elements(COALESCE(resp.criterios, resp.raw_data->'criteria')) c
  WHERE lower(c->>'type') = 'rating'
)
SELECT b.bar_id, b.falae_id, b.data_visita, e.id AS evento_id, b.criterio_raw, b.nota
FROM crit b
JOIN operations.eventos_base e ON e.bar_id = b.bar_id AND e.data_evento = b.data_visita
WHERE b.data_visita IS NOT NULL AND b.data_visita <= b.data_resposta AND b.data_visita >= b.data_resposta - 60
  AND b.nota IS NOT NULL AND b.nota BETWEEN 1 AND 5;

GRANT SELECT ON silver.nps_criterio_evento TO service_role, authenticated;
