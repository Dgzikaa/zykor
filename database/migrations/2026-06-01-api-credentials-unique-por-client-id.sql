-- ============================================================================
-- api_credentials: permitir múltiplas contas do mesmo banco no mesmo bar
--
-- Antes: UNIQUE (bar_id, sistema, ambiente) — impedia 2 credenciais Inter no
-- mesmo bar (Ordinário tem 2 contas). Agora inclui client_id; COALESCE('') mantém
-- os sistemas sem OAuth (contahub, falae, etc.) limitados a 1 por (bar,sistema,ambiente).
--
-- JÁ APLICADA EM PRODUÇÃO em 2026-06-01 (via MCP). Arquivo só pra registro/histórico.
-- ============================================================================

ALTER TABLE public.api_credentials
  DROP CONSTRAINT IF EXISTS api_credentials_bar_id_sistema_ambiente_key;

CREATE UNIQUE INDEX IF NOT EXISTS api_credentials_bar_sistema_amb_client_uk
  ON public.api_credentials (bar_id, sistema, ambiente, COALESCE(client_id, ''));
