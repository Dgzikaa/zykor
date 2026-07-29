-- 2026-07-28 — Google Meu Negócio (Business Profile): conexão por bar + métricas automáticas
--
-- Contexto: as 7 colunas gmn_* de meta.marketing_semanal são digitadas na mão (Reportei) desde
-- sempre — DesempenhoClient.tsx marca todas como status:'manual'. Este é o primeiro passo pra
-- elas virarem automáticas, no mesmo desenho que já automatizou [O] Instagram e [M] Meta Ads.
--
-- Já houve uma tentativa em fev/2026 (edge function hoje em _archived/google-reviews-callback):
-- o OAuth funcionou e gravou o token do bar 3, mas account_id/location_id ficaram NULL porque as
-- Business Profile APIs não tinham acesso liberado no projeto Google Cloud. A tabela criada lá
-- (integrations.google_oauth_tokens) é reaproveitada aqui em vez de criar uma segunda — ela já
-- tem bar_id, refresh_token, account_id e location_id, que é exatamente o que o fluxo precisa.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Estado da conexão por bar
-- ─────────────────────────────────────────────────────────────────────────────
-- A tabela original só guardava o token. Faltava o que a tela de Integrações precisa mostrar
-- (conectado por quem, quando, qual ficha, último erro) e o gate ativo/inativo — sem ele,
-- "desconectar" só teria a opção destrutiva de apagar a linha e perder o histórico.
ALTER TABLE integrations.google_oauth_tokens
  ADD COLUMN IF NOT EXISTS scopes                 text[],
  ADD COLUMN IF NOT EXISTS ativo                  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS conectado_em           timestamptz,
  ADD COLUMN IF NOT EXISTS conectado_por_usuario  uuid,
  ADD COLUMN IF NOT EXISTS desconectado_em        timestamptz,
  ADD COLUMN IF NOT EXISTS google_email           text,
  ADD COLUMN IF NOT EXISTS account_nome           text,
  ADD COLUMN IF NOT EXISTS location_nome          text,
  -- Reservado pro Google Ads: mesma conta Google autoriza os dois escopos, mas a leitura do Ads
  -- só destrava com developer token (Basic access) emitido numa conta de administrador (MCC).
  -- As colunas ficam aqui pra não precisar de nova migration quando o token sair.
  ADD COLUMN IF NOT EXISTS ads_customer_id        text,
  ADD COLUMN IF NOT EXISTS ads_login_customer_id  text,
  ADD COLUMN IF NOT EXISTS ultima_sync_em         timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_erro            text,
  ADD COLUMN IF NOT EXISTS ultimo_erro_em         timestamptz;

COMMENT ON TABLE integrations.google_oauth_tokens IS
  'Conexão Google por bar (1 linha por bar_id). Escopo business.manage = Google Meu Negócio; '
  'colunas ads_* reservadas pro Google Ads. location_id é a ficha ESCOLHIDA pro bar — uma mesma '
  'conta Google costuma enxergar as fichas de todos os bares, então a amarração é manual na tela.';
COMMENT ON COLUMN integrations.google_oauth_tokens.location_id IS
  'Nome do recurso da ficha, ex: locations/12345. NULL = autorizado mas ficha ainda não escolhida.';

-- A linha órfã de fev/2026 (bar 3, sem ficha escolhida, access_token vencido desde 10/02) não é
-- reaproveitável: nunca chegou a ter location_id e o consentimento antigo não cobre os escopos
-- atuais. Marcada como inativa pra tela mostrar "desconectada" em vez de fingir conexão viva.
-- O refresh_token é preservado — se ainda for válido, reconectar apenas o sobrescreve.
UPDATE integrations.google_oauth_tokens
   SET ativo = false,
       desconectado_em = COALESCE(desconectado_em, now()),
       ultimo_erro = COALESCE(ultimo_erro, 'Conexão de fev/2026 nunca concluída: ficha não selecionada (Business Profile API sem acesso liberado no projeto Google Cloud)')
 WHERE location_id IS NULL
   AND conectado_em IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) States do OAuth (CSRF)
-- ─────────────────────────────────────────────────────────────────────────────
-- Mesmo desenho de integrations.instagram_oauth_states, inclusive as colunas de erro: sem elas,
-- quando a conexão falha o motivo só existe no log da Vercel e some na rotação (foi o que
-- aconteceu com o Deboche em 22/07 — sobrou um state sem consumir e sem explicação).
CREATE TABLE IF NOT EXISTS integrations.google_oauth_states (
  state         text PRIMARY KEY,
  bar_id        integer NOT NULL REFERENCES operations.bares(id),
  expires_at    timestamptz NOT NULL,
  consumido_em  timestamptz,
  erro          text,
  erro_em       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_states_bar
  ON integrations.google_oauth_states (bar_id, created_at DESC);

ALTER TABLE integrations.google_oauth_states ENABLE ROW LEVEL SECURITY;

-- Sem policy e sem grant pra anon/authenticated: só service_role toca (as rotas usam service
-- role). Mesmo padrão de instagram_oauth_states — evita repetir o vazamento do hardening de anon.
REVOKE ALL ON integrations.google_oauth_states FROM anon, authenticated;
GRANT ALL ON integrations.google_oauth_states TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) updated_at confiável
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_set_updated_at ON integrations.google_oauth_tokens;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON integrations.google_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_generic();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) A tela de Desempenho precisa saber se o bar tem ficha conectada
-- ─────────────────────────────────────────────────────────────────────────────
-- Mesma lição do Instagram: o status auto/manual das métricas era hardcoded por bar_id e passou
-- a mentir no dia em que o Deboche conectou. Aqui já nasce derivado do estado real da conexão —
-- bar que conectar entra verde sozinho, bar que desconectar volta pra manual.
CREATE OR REPLACE VIEW operations.vw_bar_tem_integracao AS
 SELECT bar_id,
    max(CASE WHEN integracao = 'getin'::text THEN modo ELSE NULL::text END) AS getin_modo,
    max(CASE WHEN integracao = 'contahub'::text THEN modo ELSE NULL::text END) AS contahub_modo,
    max(CASE WHEN integracao = 'contaazul'::text THEN modo ELSE NULL::text END) AS contaazul_modo,
    max(CASE WHEN integracao = 'apify_google'::text THEN modo ELSE NULL::text END) AS apify_google_modo,
    max(CASE WHEN integracao = 'falae'::text THEN modo ELSE NULL::text END) AS falae_modo,
    max(CASE WHEN integracao = 'yuzer'::text THEN modo ELSE NULL::text END) AS yuzer_modo,
    max(CASE WHEN integracao = 'sympla'::text THEN modo ELSE NULL::text END) AS sympla_modo,
    bool_or(CASE WHEN integracao = 'getin'::text AND modo ~~ 'api%'::text THEN true ELSE false END) AS getin_api,
    bool_or(CASE WHEN integracao = 'yuzer'::text AND modo ~~ 'api%'::text THEN true ELSE false END) AS yuzer_api,
    bool_or(CASE WHEN integracao = 'sympla'::text AND modo ~~ 'api%'::text THEN true ELSE false END) AS sympla_api,
    (EXISTS ( SELECT 1
           FROM integrations.instagram_contas ic
          WHERE ic.bar_id = ib.bar_id AND ic.ativo)) AS instagram_api,
    (EXISTS ( SELECT 1
           FROM integrations.google_oauth_tokens g
          WHERE g.bar_id = ib.bar_id AND g.ativo AND g.location_id IS NOT NULL)) AS google_gmn_api
   FROM operations.integracoes_bar ib
  GROUP BY bar_id;
