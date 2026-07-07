-- NPS por EVENTO (Falae · Data da Visita → evento da noite por bar+data), SEM join de artista.
-- Serve a análise por LABEL (Ferramentas > Artistas > aba Labels): a label vem do nome do
-- evento, então o NPS por label independe de o artista estar taggeado — funciona inclusive no
-- Deboche (bar 4), onde evento_artistas está vazio. A rota /api/analitico/labels agrega por
-- label canônica (evento_id → canon). Mesmo guarda-corpo das outras views de NPS.
CREATE OR REPLACE VIEW silver.nps_evento_respostas AS
WITH resp AS (
  SELECT
    r.bar_id, r.falae_id, r.nps, r.created_at::date AS data_resposta,
    COALESCE(
      r.data_visita,
      (SELECT (c->>'name')::date
         FROM jsonb_array_elements(COALESCE(r.criterios, r.raw_data->'criteria')) c
        WHERE (lower(c->>'nick') LIKE '%data da visita%' OR lower(c->>'nick') LIKE '%data do pedido%')
          AND c->>'name' ~ '^\d{4}-\d{2}-\d{2}$'
        LIMIT 1)
    ) AS data_visita
  FROM bronze.bronze_falae_respostas r
  WHERE r.nps IS NOT NULL
)
SELECT
  v.bar_id, v.falae_id, v.nps, v.data_visita,
  e.id AS evento_id, e.nome AS evento_nome,
  CASE WHEN v.nps >= 9 THEN 'promotor' WHEN v.nps >= 7 THEN 'neutro' ELSE 'detrator' END AS categoria
FROM resp v
JOIN operations.eventos_base e ON e.bar_id = v.bar_id AND e.data_evento = v.data_visita
WHERE v.data_visita IS NOT NULL
  AND v.data_visita <= v.data_resposta
  AND v.data_visita >= v.data_resposta - 60;

GRANT SELECT ON silver.nps_evento_respostas TO service_role, authenticated;
