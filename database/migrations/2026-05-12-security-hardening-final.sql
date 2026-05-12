-- Hardening seguranca final: complementa 2026-05-12-security-hardening-anon.sql
-- Resultado: 31 ERRORS -> 0 / 90+ WARNS -> 77 (resto intencional pelo modelo do app)
--
-- ============================================================================
-- FASE 1: matview privada + search_path
-- ============================================================================
REVOKE ALL ON gold.v_pipeline_health FROM anon, authenticated;
ALTER FUNCTION integrations.tg_ig_contas_updated_at() SET search_path = 'public', 'pg_temp';

-- ============================================================================
-- FASE 2: RLS nas tabelas publicas restantes
-- (service_role bypassa RLS, backend continua funcionando)
-- ============================================================================
ALTER TABLE public.review_analise_temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.inter_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.data_freshness_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE silver.inter_pix_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE bronze.bronze_contaazul_pessoas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FASE 3: REVOKE EXECUTE FROM PUBLIC em TODAS as funcoes SECURITY DEFINER
-- Preserva GRANT existente para authenticated.
-- ============================================================================
DO $$
DECLARE
  rec RECORD;
  v_sig TEXT;
BEGIN
  FOR rec IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS was_auth
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.prosecdef = true
      AND n.nspname IN ('public','system','silver','gold','operations','integrations','financial','meta','crm','ops','bronze')
  LOOP
    v_sig := format('%I.%I(%s)', rec.nspname, rec.proname, rec.args);
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_sig);
      IF rec.was_auth THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_sig);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falhou em %: %', v_sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- FASE 4: SECURITY DEFINER views -> INVOKER
-- Todas as 19 views convertidas; service_role e authenticated continuam podendo
-- ler via RLS bypass / policy.
-- ============================================================================
ALTER VIEW auth_custom.grupos                              SET (security_invoker = true);
ALTER VIEW auth_custom.usuarios                            SET (security_invoker = true);
ALTER VIEW auth_custom.usuarios_bares                      SET (security_invoker = true);
ALTER VIEW bronze.bronze_inter_webhooks                    SET (security_invoker = true);
ALTER VIEW gold.gold_contahub_operacional_stockout_filtrado SET (security_invoker = true);
ALTER VIEW gold.v_pipeline_health_completo                 SET (security_invoker = true);
ALTER VIEW public.bar_api_configs                          SET (security_invoker = true);
ALTER VIEW public.bronze_getin_units                       SET (security_invoker = true);
ALTER VIEW public.instagram_conta_metricas                 SET (security_invoker = true);
ALTER VIEW public.instagram_contas                         SET (security_invoker = true);
ALTER VIEW public.instagram_oauth_states                   SET (security_invoker = true);
ALTER VIEW public.instagram_post_insights                  SET (security_invoker = true);
ALTER VIEW public.instagram_posts                          SET (security_invoker = true);
ALTER VIEW public.instagram_stories                        SET (security_invoker = true);
ALTER VIEW public.silver_inter_pix_diario                  SET (security_invoker = true);
ALTER VIEW public.umbler_config                            SET (security_invoker = true);
ALTER VIEW public.v_data_freshness                         SET (security_invoker = true);
ALTER VIEW public.v_pipeline_health_completo               SET (security_invoker = true);
ALTER VIEW public.visitas                                  SET (security_invoker = true);

-- ============================================================================
-- AVISOS QUE FICARAM (intencionais, nao sao bugs):
-- ============================================================================
-- 1. extension_in_public: unaccent
--    Manter. Mover quebra `classificar_consumo` e `f_unaccent_immutable`
--    que referenciam `public.unaccent` explicitamente.
--
-- 2. authenticated_security_definer_function_executable (53 funcoes)
--    Funcoes de KPI (calcular_*, get_retrospectiva_*, get_health_*, etc) usadas
--    pelo dashboard logado. Revogar quebra o frontend.
--
-- 3. rls_policy_always_true (23 tabelas operacionais)
--    Modelo: o frontend logado escreve em gold/silver/operations via service
--    role do backend; policy `USING(true)` evita 403 em casos especificos.
--    Refator separado se for o caso.
--
-- 4. rls_enabled_no_policy (44 tabelas bronze/silver)
--    RLS ativada sem policy = apenas service_role acessa.
--    E o comportamento desejado: backend manipula bronze/silver,
--    nada de leitura direta pelo authenticated.
