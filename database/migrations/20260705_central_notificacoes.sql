-- ============================================================================
-- Central de Notificações — redesign (2026-07-05)
-- Aplicada em prod via Supabase MCP (migration: redesign_notificacoes_central).
--
-- Recria system.notificacoes (estava VAZIA + enums incompatíveis com o app,
--   por isso nunca gravou nada), cria system.notification_rules (matriz admin:
--   evento → destinatários → canais), dropa operations.bar_notification_configs
--   (vazia, superada), habilita Realtime + RLS "lê as suas".
-- Ver memória: project_web_push_stack, project_central_notificacoes.
-- ============================================================================

-- 1) Tabela de notificações (in-app) --------------------------------------
DROP TABLE IF EXISTS system.notificacoes CASCADE;
DROP TYPE IF EXISTS tipo_notificacao_enum;
DROP TYPE IF EXISTS status_notificacao_enum;

CREATE TABLE system.notificacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id      integer NOT NULL,
  usuario_id  uuid NOT NULL,                         -- destinatário = usuarios.auth_id (= auth.uid())
  event_key   text NOT NULL,                         -- chave do catálogo (ex: producao_criada)
  categoria   text NOT NULL DEFAULT 'sistema',       -- financeiro | operacional | ...
  severidade  text NOT NULL DEFAULT 'info'
              CHECK (severidade IN ('info','sucesso','alerta','critico')),
  titulo      text NOT NULL,
  mensagem    text NOT NULL,
  url         text,                                  -- deep-link ao clicar
  dados       jsonb NOT NULL DEFAULT '{}'::jsonb,    -- referencia_tipo/id, extras
  canais      text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  lida        boolean NOT NULL DEFAULT false,
  lida_em     timestamptz,
  criada_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notificacoes_usuario_recentes
  ON system.notificacoes (usuario_id, criada_em DESC);
CREATE INDEX idx_notificacoes_usuario_nao_lidas
  ON system.notificacoes (usuario_id) WHERE lida = false;
CREATE INDEX idx_notificacoes_bar_recentes
  ON system.notificacoes (bar_id, criada_em DESC);

-- RLS: cada usuário lê apenas as suas. Escrita = service role (bypassa RLS).
ALTER TABLE system.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificacoes_select_own ON system.notificacoes
  FOR SELECT TO authenticated
  USING (usuario_id = (select auth.uid()));

-- Realtime: publicação + REPLICA IDENTITY FULL (p/ payloads de UPDATE completos)
ALTER TABLE system.notificacoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE system.notificacoes;

-- Grants: authenticated precisa de SELECT p/ RLS de realtime (nunca anon).
GRANT USAGE ON SCHEMA system TO authenticated;
GRANT SELECT ON system.notificacoes TO authenticated;

-- 2) Regras de roteamento (config admin por bar) --------------------------
CREATE TABLE system.notification_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id          integer NOT NULL,
  event_key       text NOT NULL,
  ativo           boolean NOT NULL DEFAULT true,
  target_roles    text[] NOT NULL DEFAULT '{}'::text[],   -- admin | financeiro | funcionario
  target_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],   -- auth_ids específicos (ex: Diego)
  canais          text[] NOT NULL DEFAULT ARRAY['in_app']::text[], -- in_app | push | whatsapp
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,      -- thresholds, quiet hours (futuro)
  criada_em       timestamptz NOT NULL DEFAULT now(),
  atualizada_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bar_id, event_key)
);
CREATE INDEX idx_notification_rules_bar ON system.notification_rules (bar_id);

-- RLS on, sem policy p/ authenticated: acesso só via API (service role).
ALTER TABLE system.notification_rules ENABLE ROW LEVEL SECURITY;

-- 3) Limpeza: tabela vazia superada -------------------------------------
DROP TABLE IF EXISTS operations.bar_notification_configs CASCADE;

COMMENT ON TABLE system.notificacoes IS 'Notificações in-app do Zykor (Central de Notificações). Realtime habilitado; RLS: usuário lê as suas.';
COMMENT ON TABLE system.notification_rules IS 'Regras de roteamento por bar: evento do catálogo → cargos/usuários alvo → canais. Configurado pelo admin na Central.';
