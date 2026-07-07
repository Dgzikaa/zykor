-- #3 — NPS × lotação: a nota de cada resposta com o PÚBLICO da noite (proxy de lotação; capacidade
-- é pouco preenchida, sobretudo no Deboche). Ocupação (%) vem junto quando há capacidade cadastrada.
-- O endpoint view=nps-lotacao fatia em tercis de público (menos/meio/mais cheio) e compara o NPS.
CREATE OR REPLACE VIEW silver.nps_lotacao AS
WITH resp AS (
  SELECT r.bar_id, r.falae_id, r.nps, r.created_at::date AS data_resposta,
    COALESCE(r.data_visita,
      (SELECT (c->>'name')::date FROM jsonb_array_elements(COALESCE(r.criterios, r.raw_data->'criteria')) c
        WHERE (lower(c->>'nick') LIKE '%data da visita%' OR lower(c->>'nick') LIKE '%data do pedido%')
          AND c->>'name' ~ '^\d{4}-\d{2}-\d{2}$' LIMIT 1)) AS data_visita
  FROM bronze.bronze_falae_respostas r WHERE r.nps IS NOT NULL
)
SELECT v.bar_id, v.falae_id, v.nps, v.data_visita,
  CASE WHEN v.nps >= 9 THEN 'promotor' WHEN v.nps >= 7 THEN 'neutro' ELSE 'detrator' END AS categoria,
  greatest(e.cl_real, e.publico_real) AS publico,
  CASE WHEN greatest(e.lot_max, e.capacidade_estimada) > 0
    THEN round(100.0 * greatest(e.cl_real, e.publico_real) / greatest(e.lot_max, e.capacidade_estimada)) END AS ocupacao_pct
FROM resp v
JOIN operations.eventos_base e ON e.bar_id = v.bar_id AND e.data_evento = v.data_visita
WHERE v.data_visita IS NOT NULL AND v.data_visita <= v.data_resposta AND v.data_visita >= v.data_resposta - 60
  AND greatest(e.cl_real, e.publico_real) > 0;

GRANT SELECT ON silver.nps_lotacao TO service_role, authenticated;
