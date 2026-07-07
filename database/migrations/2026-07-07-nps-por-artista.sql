-- =====================================================================================
-- NPS por artista — vincula a resposta do Falae ao artista que tocou na DATA DA VISITA
-- =====================================================================================
-- Contexto: o Falae coleta "Data da Visita" (a pessoa responde dias depois — no bar 4 a
-- média é 3,4 dias). Vincular a resposta ao dia REAL da visita (não ao dia da resposta) e,
-- por esse dia, ao(s) artista(s) da noite (operations.evento_artistas).
--
-- Regras acordadas: (1) puxar histórico; (2) atribuir a TODOS os artistas da noite;
-- (3) guarda-corpo na data (cliente digita à mão — teve data no futuro); (4) sem artista
-- taggeado → desconsidera a resposta.
--
-- OBS: o fixador da coluna data_visita (webhook/sync procuravam "data do pedido" em vez de
-- "Data da Visita") foi corrigido no app; aqui fazemos o backfill do histórico.

-- 1) Backfill de data_visita (idempotente: só preenche NULLs) a partir dos critérios já salvos
UPDATE bronze.bronze_falae_respostas r
SET data_visita = sub.dv
FROM (
  SELECT bar_id, falae_id,
    (SELECT (c->>'name')::date
       FROM jsonb_array_elements(COALESCE(criterios, raw_data->'criteria')) c
      WHERE (lower(c->>'nick') LIKE '%data da visita%' OR lower(c->>'nick') LIKE '%data do pedido%')
        AND c->>'name' ~ '^\d{4}-\d{2}-\d{2}$'
      LIMIT 1) AS dv
  FROM bronze.bronze_falae_respostas
  WHERE data_visita IS NULL
) sub
WHERE r.bar_id = sub.bar_id AND r.falae_id = sub.falae_id
  AND r.data_visita IS NULL AND sub.dv IS NOT NULL;

-- 2) Grão: 1 linha por (resposta × artista da noite) já validada e vinculada
CREATE OR REPLACE VIEW silver.nps_artista_respostas AS
WITH resp AS (
  SELECT
    r.bar_id, r.falae_id, r.nps, r.created_at::date AS data_resposta,
    -- usa a coluna; se ainda estiver vazia, extrai dos critérios na hora (robustez)
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
  CASE WHEN v.nps >= 9 THEN 'promotor' WHEN v.nps >= 7 THEN 'neutro' ELSE 'detrator' END AS categoria
FROM resp v
JOIN operations.eventos_base   e  ON e.bar_id = v.bar_id AND e.data_evento = v.data_visita
JOIN operations.evento_artistas ea ON ea.evento_id = e.id
WHERE v.data_visita IS NOT NULL
  AND v.data_visita <= v.data_resposta            -- visita não pode ser depois da resposta
  AND v.data_visita >= v.data_resposta - 60       -- nem mais de 60 dias antes (corta typo/futuro)
  AND btrim(COALESCE(ea.artista_nome, '')) <> ''; -- sem artista → fora

-- 3) Resumo por artista (a UI aplica o corte de amostra mínima que quiser)
CREATE OR REPLACE VIEW silver.nps_artista_resumo AS
SELECT
  bar_id, artista_id, artista_nome,
  count(*)                                                  AS respostas,
  round(avg(nps), 2)                                        AS nps_medio,
  count(*) FILTER (WHERE categoria = 'promotor')            AS promotores,
  count(*) FILTER (WHERE categoria = 'neutro')              AS neutros,
  count(*) FILTER (WHERE categoria = 'detrator')            AS detratores,
  round(100.0 * count(*) FILTER (WHERE categoria = 'promotor') / count(*)
      - 100.0 * count(*) FILTER (WHERE categoria = 'detrator') / count(*), 0)::int AS nps_score,
  min(data_visita)                                          AS primeira_visita,
  max(data_visita)                                          AS ultima_visita
FROM silver.nps_artista_respostas
GROUP BY bar_id, artista_id, artista_nome;

-- Grants: leitura pela API (service_role) e usuários autenticados; nunca anon (hardening).
GRANT SELECT ON silver.nps_artista_respostas TO service_role, authenticated;
GRANT SELECT ON silver.nps_artista_resumo    TO service_role, authenticated;
