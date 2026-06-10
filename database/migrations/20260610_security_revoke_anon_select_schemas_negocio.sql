-- 2026-06-10 | Lockdown de LEITURA: revoga SELECT do anon nos schemas de dados de negócio.
--
-- A anon key é pública (vai no bundle do frontend). Antes, qualquer um podia ler todo o gold/
-- financial/operations/etc. via PostgREST (/rest/v1/<tabela>) sem login. Verificado que o app
-- NÃO depende disso:
--   - Pages de dashboard = Server Components com createClient(URL, SUPABASE_SERVICE_ROLE_KEY|| anon).
--   - CRM/retenção/aniversariantes/data-deletion = /api ou Server Component com getAdminClient (service-role).
--   - Único client anon-puro (lib/analytics-service.ts) é CÓDIGO MORTO (zero importadores).
--   - Sem chamadas /rest/v1/ cruas no browser. Login usa Supabase Auth -> grants do 'authenticated' mantidos.
-- Teste pós-migração (SET ROLE): anon NÃO lê nenhuma das amostras; service_role lê todas. OK.
-- public e auth_custom ficam de fora (ligados a auth/Supabase) — avaliar à parte se necessário.
-- Reversível: GRANT SELECT ON ALL TABLES IN SCHEMA <s> TO anon;

DO $$
DECLARE sch text;
BEGIN
  FOREACH sch IN ARRAY ARRAY['gold','financial','operations','meta','silver','bronze','crm','integrations']
  LOOP
    EXECUTE format('REVOKE SELECT ON ALL TABLES IN SCHEMA %I FROM anon', sch);
  END LOOP;
END $$;

-- Materialized views não são cobertas por "ALL TABLES" -> revoga explícito (limpa matview_in_api)
REVOKE SELECT ON crm.clientes_em_queda FROM anon;
REVOKE SELECT ON crm.aniversariantes FROM anon;
REVOKE SELECT ON gold.cliente_coorte_mensal FROM anon;
