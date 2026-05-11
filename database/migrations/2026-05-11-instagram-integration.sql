-- Instagram integration — multi-tenant (1 conta IG por bar)
-- Cada bar tem dono próprio, então cada um autoriza separado
-- Pattern segue integrations.google_oauth_tokens
-- Aplicado em 2026-05-11

-- ============================================================================
-- 1. CONFIG/AUTH — 1 linha por bar
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations.instagram_contas (
  id                    SERIAL PRIMARY KEY,
  bar_id                INTEGER NOT NULL UNIQUE,
  ig_business_id        TEXT NOT NULL,
  ig_username           TEXT,
  facebook_page_id      TEXT NOT NULL,
  facebook_page_name    TEXT,
  access_token          TEXT NOT NULL,
  token_type            TEXT DEFAULT 'long_lived_user',  -- ou 'system_user'
  expires_at            TIMESTAMPTZ,
  scopes                TEXT[],
  ativo                 BOOLEAN DEFAULT true,
  ultima_sync_em        TIMESTAMPTZ,
  conectado_em          TIMESTAMPTZ DEFAULT NOW(),
  conectado_por_usuario UUID,  -- auth_id do dono que autorizou
  desconectado_em       TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE integrations.instagram_contas IS
  'OAuth + config da integração Instagram por bar. 1 linha por bar_id. Token salvo aqui (não em env), pois cada bar é negócio independente com auth própria.';

CREATE INDEX IF NOT EXISTS idx_instagram_contas_bar_ativo
  ON integrations.instagram_contas(bar_id) WHERE ativo;

-- ============================================================================
-- 2. POSTS (Reels, Image, Video, Carousel) — metadata permanente
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations.instagram_posts (
  id                BIGSERIAL PRIMARY KEY,
  bar_id            INTEGER NOT NULL,
  ig_media_id       TEXT NOT NULL,
  media_type        TEXT,         -- IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type TEXT,        -- FEED | REELS | STORY (aqui só FEED/REELS, story tem tabela própria)
  caption           TEXT,
  permalink         TEXT,
  media_url         TEXT,
  thumbnail_url     TEXT,
  timestamp_post    TIMESTAMPTZ,
  is_shared_to_feed BOOLEAN,
  comments_count    INTEGER,      -- snapshot da última captura
  like_count        INTEGER,      -- snapshot da última captura
  raw_data          JSONB,
  capturado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bar_id, ig_media_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_bar_data
  ON integrations.instagram_posts(bar_id, timestamp_post DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_media_type
  ON integrations.instagram_posts(bar_id, media_product_type, timestamp_post DESC);

-- ============================================================================
-- 3. POST INSIGHTS — snapshot diário (métricas acumulam)
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations.instagram_post_insights (
  id                  BIGSERIAL PRIMARY KEY,
  bar_id              INTEGER NOT NULL,
  ig_media_id         TEXT NOT NULL,
  data_snapshot       DATE NOT NULL,
  reach               INTEGER,
  impressions         INTEGER,
  saved               INTEGER,
  likes               INTEGER,
  comments            INTEGER,
  shares              INTEGER,
  video_views         INTEGER,
  total_interactions  INTEGER,
  plays               INTEGER,     -- reels
  ig_reels_avg_watch_time INTEGER, -- reels
  raw_data            JSONB,
  capturado_em        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bar_id, ig_media_id, data_snapshot)
);

CREATE INDEX IF NOT EXISTS idx_ig_post_insights_bar_data
  ON integrations.instagram_post_insights(bar_id, data_snapshot DESC);
CREATE INDEX IF NOT EXISTS idx_ig_post_insights_media
  ON integrations.instagram_post_insights(ig_media_id, data_snapshot DESC);

-- ============================================================================
-- 4. STORIES — efêmero, captura única (story some em 24h)
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations.instagram_stories (
  id                BIGSERIAL PRIMARY KEY,
  bar_id            INTEGER NOT NULL,
  ig_media_id       TEXT NOT NULL,
  media_type        TEXT,
  permalink         TEXT,
  media_url         TEXT,
  thumbnail_url     TEXT,
  timestamp_post    TIMESTAMPTZ,
  -- métricas (só obteníveis enquanto story está vivo)
  impressions       INTEGER,
  reach             INTEGER,
  replies           INTEGER,
  exits             INTEGER,
  taps_forward      INTEGER,
  taps_back         INTEGER,
  swipe_forward     INTEGER,
  follows           INTEGER,
  profile_visits    INTEGER,
  shares            INTEGER,
  raw_data          JSONB,
  capturado_em      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bar_id, ig_media_id)
);

CREATE INDEX IF NOT EXISTS idx_instagram_stories_bar_data
  ON integrations.instagram_stories(bar_id, timestamp_post DESC);

-- ============================================================================
-- 5. CONTA METRICS — followers, demografia, audiência (snapshot diário)
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations.instagram_conta_metricas (
  id                    BIGSERIAL PRIMARY KEY,
  bar_id                INTEGER NOT NULL,
  data_snapshot         DATE NOT NULL,
  followers_count       INTEGER,
  follows_count         INTEGER,
  media_count           INTEGER,
  profile_views         INTEGER,
  website_clicks        INTEGER,
  reach                 INTEGER,
  impressions           INTEGER,
  email_contacts        INTEGER,
  phone_call_clicks     INTEGER,
  text_message_clicks   INTEGER,
  get_directions_clicks INTEGER,
  online_followers      JSONB,  -- audiência por hora
  audience_city         JSONB,
  audience_country      JSONB,
  audience_gender_age   JSONB,
  audience_locale       JSONB,
  raw_data              JSONB,
  capturado_em          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bar_id, data_snapshot)
);

CREATE INDEX IF NOT EXISTS idx_ig_conta_metricas_bar_data
  ON integrations.instagram_conta_metricas(bar_id, data_snapshot DESC);

-- ============================================================================
-- 6. SYNC LOGS — auditoria das execuções de cron
-- ============================================================================
CREATE TABLE IF NOT EXISTS integrations.instagram_sync_logs (
  id                BIGSERIAL PRIMARY KEY,
  bar_id            INTEGER,
  tipo_sync         TEXT NOT NULL,   -- 'posts' | 'stories' | 'post_insights' | 'account'
  status            TEXT NOT NULL,   -- 'success' | 'partial' | 'error'
  itens_processados INTEGER DEFAULT 0,
  itens_novos       INTEGER DEFAULT 0,
  itens_atualizados INTEGER DEFAULT 0,
  erro_mensagem     TEXT,
  duracao_ms        INTEGER,
  iniciado_em       TIMESTAMPTZ DEFAULT NOW(),
  concluido_em      TIMESTAMPTZ,
  raw_response      JSONB
);

CREATE INDEX IF NOT EXISTS idx_ig_sync_logs_recente
  ON integrations.instagram_sync_logs(bar_id, tipo_sync, iniciado_em DESC);

-- ============================================================================
-- 7. RLS — service_role acessa tudo; usuários do bar leem só o seu
-- ============================================================================
ALTER TABLE integrations.instagram_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_post_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_conta_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.instagram_sync_logs ENABLE ROW LEVEL SECURITY;

-- Service role pode tudo (edge functions usam service_role)
DROP POLICY IF EXISTS ig_contas_service_all ON integrations.instagram_contas;
CREATE POLICY ig_contas_service_all ON integrations.instagram_contas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ig_posts_service_all ON integrations.instagram_posts;
CREATE POLICY ig_posts_service_all ON integrations.instagram_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ig_post_ins_service_all ON integrations.instagram_post_insights;
CREATE POLICY ig_post_ins_service_all ON integrations.instagram_post_insights
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ig_stories_service_all ON integrations.instagram_stories;
CREATE POLICY ig_stories_service_all ON integrations.instagram_stories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ig_conta_met_service_all ON integrations.instagram_conta_metricas;
CREATE POLICY ig_conta_met_service_all ON integrations.instagram_conta_metricas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ig_sync_logs_service_all ON integrations.instagram_sync_logs;
CREATE POLICY ig_sync_logs_service_all ON integrations.instagram_sync_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 8. TRIGGER updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION integrations.tg_ig_contas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ig_contas_updated ON integrations.instagram_contas;
CREATE TRIGGER trg_ig_contas_updated
  BEFORE UPDATE ON integrations.instagram_contas
  FOR EACH ROW EXECUTE FUNCTION integrations.tg_ig_contas_updated_at();

-- ============================================================================
-- 9. View-alias public.* pra PostgREST (pattern do projeto)
-- ============================================================================
CREATE OR REPLACE VIEW public.instagram_contas AS
  SELECT * FROM integrations.instagram_contas;

CREATE OR REPLACE VIEW public.instagram_posts AS
  SELECT * FROM integrations.instagram_posts;

CREATE OR REPLACE VIEW public.instagram_post_insights AS
  SELECT * FROM integrations.instagram_post_insights;

CREATE OR REPLACE VIEW public.instagram_stories AS
  SELECT * FROM integrations.instagram_stories;

CREATE OR REPLACE VIEW public.instagram_conta_metricas AS
  SELECT * FROM integrations.instagram_conta_metricas;
