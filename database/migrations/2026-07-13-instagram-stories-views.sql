-- Marketing P3 (2026-07-13) — Stories: capturar Visualizações (views)
--
-- Causa: a Graph API descontinuou `impressions` pra stories (virou `views`). A function
-- instagram-sync-stories pedia `impressions` e gravava nessa coluna → sempre NULL, mesmo
-- com o valor certo já presente em raw_data.insights.views. Aqui adicionamos as colunas e
-- fazemos BACKFILL retroativo a partir do raw_data (sem perda — o dado já estava capturado).
--
-- Já aplicado em produção via MCP em 2026-07-13 (mantido aqui pro versionamento).

ALTER TABLE integrations.instagram_stories
  ADD COLUMN IF NOT EXISTS views integer,
  ADD COLUMN IF NOT EXISTS total_interactions integer;

UPDATE integrations.instagram_stories
SET views = NULLIF(raw_data->'insights'->>'views','')::int,
    total_interactions = NULLIF(raw_data->'insights'->>'total_interactions','')::int
WHERE raw_data ? 'insights';
