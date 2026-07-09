-- Persistência da Análise de Receita (Bloco 3): contexto do período + cards editados/
-- aprovados (Problemas/Oportunidades/Reflexões) por bar + mês. Aplicada em prod via MCP 2026-07-08.
CREATE TABLE IF NOT EXISTS meta.analise_receita (
  id serial PRIMARY KEY,
  bar_id integer NOT NULL,
  mes text NOT NULL,
  contexto text,
  problemas jsonb DEFAULT '[]'::jsonb,
  oportunidades jsonb DEFAULT '[]'::jsonb,
  reflexoes jsonb DEFAULT '[]'::jsonb,
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE (bar_id, mes)
);

GRANT SELECT ON meta.analise_receita TO authenticated;
GRANT ALL ON meta.analise_receita TO service_role;
GRANT USAGE, SELECT ON SEQUENCE meta.analise_receita_id_seq TO service_role;
