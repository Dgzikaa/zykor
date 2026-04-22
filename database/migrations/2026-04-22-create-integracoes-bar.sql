-- Tabela mestre de integracoes por bar
-- Determina quais campos sao automaticos vs manuais por bar
CREATE TABLE IF NOT EXISTS operations.integracoes_bar (
  id serial PRIMARY KEY,
  bar_id integer NOT NULL REFERENCES operations.bares(id),
  integracao text NOT NULL,
  modo text NOT NULL CHECK (modo IN ('api_automatica', 'api_diaria', 'api_esporadica', 'manual', 'inativa')),
  observacao text,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE(bar_id, integracao)
);

INSERT INTO operations.integracoes_bar
  (bar_id, integracao, modo, observacao) VALUES
  (3, 'contahub',      'api_automatica', NULL),
  (3, 'contaazul',     'api_automatica', NULL),
  (3, 'getin',         'api_automatica', NULL),
  (3, 'apify_google',  'api_diaria',     NULL),
  (3, 'falae',         'api_automatica', NULL),
  (3, 'yuzer',         'api_esporadica', 'Apenas eventos com Yuzer'),
  (3, 'sympla',        'api_esporadica', 'Apenas eventos com Sympla'),
  (4, 'contahub',      'api_automatica', NULL),
  (4, 'contaazul',     'api_automatica', NULL),
  (4, 'getin',         'manual',         'Usuario copia dados do site do Getin'),
  (4, 'apify_google',  'api_diaria',     NULL),
  (4, 'falae',         'api_automatica', NULL)
ON CONFLICT (bar_id, integracao) DO NOTHING;

-- View helper pivot
CREATE OR REPLACE VIEW operations.vw_bar_tem_integracao AS
SELECT
  bar_id,
  MAX(CASE WHEN integracao = 'getin' THEN modo END) as getin_modo,
  MAX(CASE WHEN integracao = 'contahub' THEN modo END) as contahub_modo,
  MAX(CASE WHEN integracao = 'contaazul' THEN modo END) as contaazul_modo,
  MAX(CASE WHEN integracao = 'apify_google' THEN modo END) as apify_google_modo,
  MAX(CASE WHEN integracao = 'falae' THEN modo END) as falae_modo,
  MAX(CASE WHEN integracao = 'yuzer' THEN modo END) as yuzer_modo,
  MAX(CASE WHEN integracao = 'sympla' THEN modo END) as sympla_modo,
  BOOL_OR(CASE WHEN integracao = 'getin' AND modo LIKE 'api%' THEN true ELSE false END) as getin_api,
  BOOL_OR(CASE WHEN integracao = 'yuzer' AND modo LIKE 'api%' THEN true ELSE false END) as yuzer_api,
  BOOL_OR(CASE WHEN integracao = 'sympla' AND modo LIKE 'api%' THEN true ELSE false END) as sympla_api
FROM operations.integracoes_bar
GROUP BY bar_id;
