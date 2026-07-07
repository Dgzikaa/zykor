-- Adiciona o comentário (resposta discursiva do Falae) à view de grão do NPS por artista,
-- pra tela "Visão do Artista" mostrar cada resposta ao clicar no card de NPS.
CREATE OR REPLACE VIEW silver.nps_artista_respostas AS
WITH resp AS (
  SELECT
    r.bar_id, r.falae_id, r.nps, r.created_at::date AS data_resposta,
    r.discursive_question,
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
  v.bar_id, v.falae_id, v.nps, v.data_resposta, v.data_visita,
  e.id AS evento_id, e.nome AS evento_nome,
  ea.artista_id, ea.artista_nome,
  CASE WHEN v.nps >= 9 THEN 'promotor' WHEN v.nps >= 7 THEN 'neutro' ELSE 'detrator' END AS categoria,
  NULLIF(btrim(v.discursive_question), '') AS comentario
FROM resp v
JOIN operations.eventos_base   e  ON e.bar_id = v.bar_id AND e.data_evento = v.data_visita
JOIN operations.evento_artistas ea ON ea.evento_id = e.id
WHERE v.data_visita IS NOT NULL
  AND v.data_visita <= v.data_resposta
  AND v.data_visita >= v.data_resposta - 60
  AND btrim(COALESCE(ea.artista_nome, '')) <> '';

GRANT SELECT ON silver.nps_artista_respostas TO service_role, authenticated;
