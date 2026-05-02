-- 2026-05-02: Security hardening (resposta aos advisors do Supabase)
--
-- 4 fixes mecanicos de seguranca, baixo risco, validados em prod:
--
-- 1. function_search_path_mutable (~70 funcoes)
--    Aplicar SET search_path explicito pra evitar hijack via search_path.
--    Schema list cobre todos schemas usados (public, operations, financial,
--    system, integrations, bronze, silver, gold, crm, ops, pg_catalog) pra
--    nao quebrar funcoes que assumem search_path implicito.
--
-- 2. anon_security_definer_function_executable (116 funcoes)
--    Revogar EXECUTE de PUBLIC e anon em todas SECURITY DEFINER nos schemas
--    do projeto. Frontend Zykor usa Next.js API routes com SUPABASE_SERVICE_ROLE_KEY,
--    nunca chama RPC com role anon. Cron jobs usam service_role. Logo, anon
--    nao deveria conseguir disparar admin_save_tokens, etl_*, sync_*, etc.
--    Resultado: 116 -> 0 callable por anon.
--
-- 3. authenticated_security_definer_function_executable (83 funcoes admin/ETL)
--    Revogar EXECUTE de authenticated em funcoes admin/ETL/sync/cron.
--    Manter authenticated em: auth helpers (is_user_admin, user_has_*, get_user_*),
--    queries de leitura usadas pela UI (get_consumos_*, get_retrospectiva_*,
--    calcular_*, get_health_dashboard, etc).
--    Resultado: 116 -> 33 callable por authenticated.
--
-- 4. rls_disabled_in_public (24 tabelas)
--    Habilitar RLS + politicas amplas (authenticated read+write, service_role all)
--    em tabelas expostas via PostgREST que nao tinham RLS. Como Zykor e app
--    interna, politica ampla nao bloqueia funcionalidade mas fecha leitura
--    anonima.
--
-- 5. materialized_view_in_api (2 MVs)
--    REVOKE SELECT FROM anon em view_visao_geral_anual e v_pipeline_health.
--
-- Validacao pos-aplicacao:
--   get_consumos_classificados_semana(3, '2026-04-21', '2026-04-27') retorna
--   o esperado: socios 39.95, artistas 13207, clientes 2427, op 2344, esc 15.
--
-- Aplicado direto via MCP. Este arquivo arquiva os blocos pra replicacao em
-- outro ambiente (ex: branch Supabase de dev) e referencia historica.

-- ============================================================
-- BLOCO 1: search_path fix
-- ============================================================
DO $$
DECLARE r record; v_path text;
BEGIN
  v_path := 'public, operations, financial, system, integrations, bronze, silver, gold, crm, ops, pg_catalog';
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','operations','ops','bronze','system','financial','crm','silver','gold')
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = %s',
        r.schema_name, r.func_name, r.args, v_path);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.%(%): %', r.schema_name, r.func_name, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- BLOCO 2: revoke EXECUTE FROM anon em SECURITY DEFINER
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','operations','ops','bronze','system','financial','crm','silver','gold')
      AND p.prokind = 'f'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', r.schema_name, r.func_name, r.args);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', r.schema_name, r.func_name, r.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.%(%): %', r.schema_name, r.func_name, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- BLOCO 3: revoke EXECUTE FROM authenticated em ETL/sync/admin
-- ============================================================
DO $$
DECLARE r record;
  v_admin_prefixes text[] := ARRAY[
    'admin_%', 'etl_%', 'sync_%', 'yuzer_cron_%', 'yuzer_sync_%',
    'sympla_cron_%', 'sympla_sync_%', 'sympla_get_%',
    'contaazul_get_%', 'adapter_contahub_%', 'bronze_sync_%',
    'cleanup_%', 'limpar_%', 'processar_%', 'rodar_adapters_%',
    'update_eventos_%', 'refresh_v_%',
    'enviar_alerta_discord_sistema%', 'acquire_job_lock', 'release_job_lock',
    'verificar_saude_%', 'verificar_sync_%',
    'agregar_cmv_mensal_auto', 'calcular_real_r',
    'get_service_role_key', 'registrar_historico_eventos'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','operations','ops','bronze','system','financial','crm','silver','gold')
      AND p.prokind = 'f'
      AND p.prosecdef = true
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      AND EXISTS (SELECT 1 FROM unnest(v_admin_prefixes) prefix WHERE p.proname LIKE prefix)
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated',
        r.schema_name, r.func_name, r.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.%(%): %', r.schema_name, r.func_name, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- BLOCO 4: RLS + policies amplas em 24 tabelas expostas
-- ============================================================
DO $$
DECLARE
  v_tabelas text[][] := ARRAY[
    ['bronze','bronze_contahub_tentativas'],
    ['financial','consumos_keywords'],
    ['system','sync_logs_contahub'],
    ['operations','produto_categoria_mix'],
    ['silver','vendas_diarias'],
    ['public','cmv_manual'],
    ['silver','cliente_visitas'],
    ['silver','cliente_estatisticas'],
    ['silver','produtos_top'],
    ['silver','google_reviews_diario'],
    ['silver','getin_reservas_diarias'],
    ['silver','sympla_bilheteria_diaria'],
    ['silver','nps_diario'],
    ['silver','contaazul_lancamentos_diarios'],
    ['silver','yuzer_pagamentos_evento'],
    ['silver','yuzer_produtos_evento'],
    ['gold','planejamento'],
    ['operations','etl_execucoes_log'],
    ['gold','cmv'],
    ['gold','clientes_diario'],
    ['gold','desempenho'],
    ['silver','reservantes_perfil'],
    ['operations','integracoes_bar']
  ];
  v_schema text; v_table text;
BEGIN
  FOR i IN 1..array_length(v_tabelas, 1) LOOP
    v_schema := v_tabelas[i][1];
    v_table := v_tabelas[i][2];
    BEGIN
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_schema, v_table);
      EXECUTE format('CREATE POLICY "auth_select" ON %I.%I FOR SELECT TO authenticated USING (true)', v_schema, v_table);
      EXECUTE format('CREATE POLICY "auth_write" ON %I.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', v_schema, v_table);
      EXECUTE format('CREATE POLICY "service_all" ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', v_schema, v_table);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.%: %', v_schema, v_table, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================
-- BLOCO 5: revoke anon em materialized views
-- ============================================================
REVOKE SELECT ON public.view_visao_geral_anual FROM anon;
REVOKE SELECT ON gold.v_pipeline_health FROM anon;
