-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATIONS CONSOLIDADAS - ZYKOR CAMADAS 1-5
-- Executar este arquivo no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ===============================================
-- 1.1: Colunas de tempo limite (C3-1)
-- ===============================================
ALTER TABLE bar_regras_negocio 
ADD COLUMN IF NOT EXISTS tempo_limite_bar_segundos INTEGER DEFAULT 600,
ADD COLUMN IF NOT EXISTS tempo_limite_cozinha_segundos INTEGER DEFAULT 1200;

COMMENT ON COLUMN bar_regras_negocio.tempo_limite_bar_segundos IS 'Limite de tempo em segundos para considerar atraso no bar (default 600 = 10 min)';
COMMENT ON COLUMN bar_regras_negocio.tempo_limite_cozinha_segundos IS 'Limite de tempo em segundos para considerar atraso na cozinha (default 1200 = 20 min)';

-- ===============================================
-- 1.2: Stockout exclusions config (HC-2)
-- ===============================================
ALTER TABLE bar_local_mapeamento 
ADD COLUMN IF NOT EXISTS produtos_excluidos_stockout TEXT[] DEFAULT '{}';

INSERT INTO bar_local_mapeamento (bar_id, categoria, locais, ativo, produtos_excluidos_stockout)
VALUES (
  4, 
  'excluidos', 
  '{}', 
  true,
  ARRAY['dose dupla', 'dose dulpa', 'chegadeira', 'sem alcool', 'grupo adicional', 'promo chivas', 'uso interno']
)
ON CONFLICT (bar_id, categoria) 
DO UPDATE SET produtos_excluidos_stockout = EXCLUDED.produtos_excluidos_stockout;

INSERT INTO bar_local_mapeamento (bar_id, categoria, locais, ativo, produtos_excluidos_stockout)
VALUES (3, 'excluidos', '{}', true, '{}')
ON CONFLICT (bar_id, categoria) DO NOTHING;

-- ===============================================
-- 1.3: Horas media visita (HC-3)
-- ===============================================
ALTER TABLE bar_regras_negocio 
ADD COLUMN IF NOT EXISTS horas_media_visita NUMERIC DEFAULT 2.5;

UPDATE bar_regras_negocio SET horas_media_visita = 2.5 WHERE bar_id = 3;
UPDATE bar_regras_negocio SET horas_media_visita = 2.5 WHERE bar_id = 4;

-- ===============================================
-- 1.4: Tabela bar_artistas (HC-4)
-- ===============================================
CREATE TABLE IF NOT EXISTS bar_artistas (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL REFERENCES bares_config(bar_id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('banda', 'dj', 'solo')),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bar_id, nome)
);

INSERT INTO bar_artistas (bar_id, nome, tipo) VALUES
(3, 'Breno Alves', 'banda'),
(3, 'Benzadeus', 'banda'),
(3, 'Bonsai', 'banda'),
(3, 'Boka de Sergipe', 'banda'),
(3, 'Pe no Chao', 'banda'),
(3, '7naRoda', 'banda'),
(3, 'Doze', 'banda'),
(3, 'STZ', 'banda'),
(3, 'Sambadona', 'banda'),
(3, 'Reconvexa', 'banda'),
(3, 'Na Medida', 'banda'),
(3, 'Gigi', 'solo'),
(3, 'Pagode da Gigi', 'banda'),
(3, 'Clima de Montanha', 'banda'),
(3, 'Inacio Rios', 'solo'),
(3, 'Mosquito', 'solo'),
(3, 'Marina Iris', 'solo'),
(3, 'Marcelle Motta', 'solo'),
(3, 'Lucas Alves', 'solo'),
(3, 'Umiranda', 'solo'),
(3, 'Stephanie', 'solo'),
(3, 'Dj Jess Ullun', 'dj'),
(3, 'Dj Vinny', 'dj'),
(3, 'Dj Caju', 'dj'),
(3, 'Dj Negritah', 'dj'),
(3, 'Dj Afrika', 'dj'),
(3, 'Dj Leo Cabral', 'dj'),
(3, 'Dj Tiago Jousef', 'dj')
ON CONFLICT (bar_id, nome) DO NOTHING;

ALTER TABLE bar_artistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bar_artistas_select" ON bar_artistas;
CREATE POLICY "bar_artistas_select" ON bar_artistas
  FOR SELECT USING (
    bar_id = (SELECT bar_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===============================================
-- 1.5: Cron jobs analise diaria v2
-- ===============================================
SELECT cron.unschedule('analise-diaria-v2-bar3') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'analise-diaria-v2-bar3'
);
SELECT cron.unschedule('analise-diaria-v2-bar4') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'analise-diaria-v2-bar4'
);

SELECT cron.schedule(
  'analise-diaria-v2-bar3',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/agente-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"action":"analise-diaria-v2","bar_id":3}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'analise-diaria-v2-bar4',
  '5 12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/agente-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"action":"analise-diaria-v2","bar_id":4}'::jsonb
  );
  $$
);

-- ===============================================
-- VALIDACAO
-- ===============================================
SELECT 'bar_artistas' as tabela, count(*) as registros FROM bar_artistas
UNION ALL
SELECT 'cron_jobs', count(*) FROM cron.job WHERE jobname LIKE 'analise-diaria-v2%';
