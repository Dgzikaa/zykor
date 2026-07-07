-- #6 — Comentários abertos do Falae (discursive_question) com categoria + data, p/ mineração de temas.
-- A classificação em temas (Atendimento/Preço/Fila/Som/...) é feita no app (lib nps-temas, por
-- palavra-chave — determinístico, sem custo de LLM; dá pra evoluir pra IA depois).
CREATE OR REPLACE VIEW silver.nps_comentarios AS
SELECT r.bar_id, r.falae_id, r.nps,
  r.created_at::date AS data_resposta,
  COALESCE(
    r.data_visita,
    (SELECT (c->>'name')::date FROM jsonb_array_elements(COALESCE(r.criterios, r.raw_data->'criteria')) c
      WHERE (lower(c->>'nick') LIKE '%data da visita%' OR lower(c->>'nick') LIKE '%data do pedido%')
        AND c->>'name' ~ '^\d{4}-\d{2}-\d{2}$' LIMIT 1)
  ) AS data_visita,
  CASE WHEN r.nps >= 9 THEN 'promotor' WHEN r.nps >= 7 THEN 'neutro' ELSE 'detrator' END AS categoria,
  btrim(r.discursive_question) AS comentario
FROM bronze.bronze_falae_respostas r
WHERE r.nps IS NOT NULL AND NULLIF(btrim(r.discursive_question), '') IS NOT NULL;

GRANT SELECT ON silver.nps_comentarios TO service_role, authenticated;
