-- 2026-06-10 | Hardening WARN: funções SECURITY DEFINER internas executáveis por anon/authenticated
--
-- O linter (0028/0029) apontou ~25 funções SECURITY DEFINER chamáveis por anon/authenticated via
-- /rest/v1/rpc. Análise (grep no frontend p/ .rpc fora de /api + pg_policies):
--   - Helpers de RLS (user_has_bar_access, user_has_access_to_bar/empresa, is_user_admin, get_user_cpf)
--     estão em ~80 policies -> NÃO mexer (revogar authenticated quebraria as policies).
--   - Funções de leitura chamadas via client anon no frontend (menu_engineering, garcom_performance,
--     clube_*, cardapio_*, produto_combos, calcular_metricas/visao/retencao, get_* etc.) + a MUTATION
--     set_produto_custo_manual -> precisam de refactor (rotear p/ /api service-role) antes de revogar.
--   - Internas (jobs/sync/health) abaixo: NENHUMA chamada pelo frontend anon; só pg_cron/edge (service_role).
--     Algumas estavam abertas ao anon ANÔNIMO (sympla/ig/stockout sync, snapshot, alerta Discord).
-- Ação: REVOKE de PUBLIC/anon/authenticated + GRANT explícito a service_role.

DO $$
DECLARE
  sigs text[] := ARRAY[
    'operations.snapshot_produto_custo(date)',
    'public.ig_sync_diario_executar(integer, text)',
    'public.stockout_executar_completo(integer, date, text)',
    'public.sympla_get_eventos(integer)',
    'public.sympla_sync_diario(integer)',
    'public.sympla_sync_eventos(integer)',
    'public.sync_custo_planilha(integer, jsonb)',
    'public.verificar_saude_cmv_desempenho_alerta_discord()',
    'public.calcular_atrasos_tempo(integer, date, date)',
    'public.calcular_clientes_ativos_periodo(integer, date, date, date)',
    'public.calcular_stockout_semanal(integer, date, date)',
    'public.calcular_tempo_saida(integer, date, date)',
    'public.get_cron_stats_24h()',
    'public.get_supabase_url()',
    'public.health_cron_stats_24h()',
    'public.health_metrics_snapshot()',
    'public.validar_ano_desempenho()',
    'public.verificar_data_freshness()',
    'system.health_cron_stats_24h()',
    'system.health_metrics_snapshot()'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', s);
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname='lint_db_functions' AND pronamespace='public'::regnamespace
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', r.sig);
  END LOOP;
END $$;
