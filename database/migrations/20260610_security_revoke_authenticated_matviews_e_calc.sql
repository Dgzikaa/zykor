-- 2026-06-10 | Limpeza final dos WARN: matviews + calc-functions executáveis por authenticated.
-- Matviews (clientes_em_queda, aniversariantes, cliente_coorte_mensal) são lidas só via /api
-- (service-role) -> revoga authenticated (anon já revogado). Limpa materialized_view_in_api.
-- Calc-functions rodam em Server Components com service-role (visao-geral/desempenho/indicadores) ->
-- revoga authenticated, mantém service_role. NÃO mexido: 6 helpers de RLS (user_has_*, is_user_admin,
-- get_user_cpf, get_user_bar_id) — obrigatórios nas ~80 policies (revogar quebraria o RLS).

REVOKE SELECT ON crm.clientes_em_queda FROM authenticated;
REVOKE SELECT ON crm.aniversariantes FROM authenticated;
REVOKE SELECT ON gold.cliente_coorte_mensal FROM authenticated;

DO $$
DECLARE
  sigs text[] := ARRAY[
    'public.calcular_metricas_clientes(integer, date, date, date, date)',
    'public.calcular_retencao_real_visao_geral(integer, date, date, date, date, date, date)',
    'public.calcular_visao_geral_anual(integer, integer)',
    'public.calcular_visao_geral_trimestral(integer, integer, integer)',
    'public.get_count_base_ativa(integer, date, date)',
    'public.bar_fechado_no_dia(integer, date)'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', s);
  END LOOP;
END $$;
