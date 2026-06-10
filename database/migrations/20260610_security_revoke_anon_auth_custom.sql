-- 2026-06-10 | Tranca auth_custom (PII de usuários) para o anon.
-- Verificado: auth_custom.usuarios é lido só por get-user.ts/api-wrapper.ts (getAdminClient) e
-- UsuariosRepository (instanciado em repositories/index.ts com client service-role). Login usa
-- Supabase Auth (GoTrue), não lê auth_custom via anon. Mantém authenticated. Reversível via GRANT.
REVOKE SELECT ON ALL TABLES IN SCHEMA auth_custom FROM anon;
