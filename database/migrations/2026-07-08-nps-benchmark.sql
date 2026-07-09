-- Benchmark de NPS de concorrentes (entrada manual) — exibido no card de NPS do Dashboard
-- de Receitas, com edição inline. Aplicada em produção via MCP em 2026-07-08.
CREATE TABLE IF NOT EXISTS meta.nps_benchmark (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  nps integer NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz DEFAULT now()
);

GRANT SELECT ON meta.nps_benchmark TO authenticated;
GRANT ALL ON meta.nps_benchmark TO service_role;
GRANT USAGE, SELECT ON SEQUENCE meta.nps_benchmark_id_seq TO service_role;

INSERT INTO meta.nps_benchmark (nome, nps, ordem)
SELECT * FROM (VALUES ('Coco Bambu', 66, 1), ('Outback', 65, 2), ('Madero', 64, 3)) AS v(nome, nps, ordem)
WHERE NOT EXISTS (SELECT 1 FROM meta.nps_benchmark);
