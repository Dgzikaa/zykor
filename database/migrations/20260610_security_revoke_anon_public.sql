-- 2026-06-10 | Tranca o schema public para o anon. CRÍTICO: anon lia api_credentials (segredos),
-- usuarios/usuarios_bares (PII), instagram_oauth_states, e dados de negócio via /rest/v1/<tabela>.
-- Verificado: o browser só usa supabase.auth (GoTrue) via anon; sem Realtime/.channel; sem client
-- anon-puro (o único era lib/analytics-service.ts, agora deletado). Resto é Server Component/API
-- com service-role. Mantém authenticated (login via Supabase Auth), EXCETO api_credentials
-- (segredo: só service-role). Teste SET ROLE confirmou anon bloqueado e service_role lendo.
-- Reversível: GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE SELECT ON public.api_credentials FROM authenticated;
