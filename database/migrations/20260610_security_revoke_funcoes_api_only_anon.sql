-- 2026-06-10 | Hardening WARN (0028/0029): funções SECURITY DEFINER de dados/escrita
-- executáveis por anon/authenticated via /rest/v1/rpc, mas chamadas SOMENTE por rotas /api
-- (service-role — verificado que todo rpc-caller em /api usa getAdminClient).
-- O frontend NUNCA as chama pelo browser: grep correto (com nome de arquivo) mostra que só
-- 8 funções rodam fora de /api (calculate_evento_metrics, calcular_metricas_clientes,
-- get_mix_qtd_por_semana/mes, calcular_visao_geral_anual/trimestral, get_count_base_ativa,
-- calcular_retencao_real_visao_geral) — nenhuma delas está nesta lista; ficam com anon por ora.
-- NÃO mexido: helpers de RLS (user_has_*, is_user_admin, get_user_cpf, get_user_bar_id) — em ~80 policies.
-- Risco real fechado: clube_export (exfiltração da base de clientes via chave pública), menu_engineering,
-- get_cliente_stats_agregado, set_produto_custo_manual (escrita), etc.

DO $$
DECLARE
  sigs text[] := ARRAY[
    'crm.clube_export(integer, text, text)',
    'crm.clube_resumo(integer)',
    'gold.garcom_performance(integer, integer)',
    'gold.produto_combos(integer, integer, integer)',
    'public.garcom_performance(integer, integer)',
    'public.produto_combos(integer, integer, integer)',
    'public.cardapio_custo_mudancas(integer, integer)',
    'public.cardapio_custo_serie(integer, text, integer)',
    'public.cardapio_produtos_custo(integer, integer)',
    'public.menu_engineering(integer, date, date)',
    'public.noshow_lista_com_presenca(integer, date, date)',
    'public.cac_roas_mensal(integer, integer)',
    'public.calcular_stockout_dia(integer, date)',
    'public.count_distinct_clientes_periodo(integer, date, date)',
    'public.get_cliente_stats_agregado(integer)',
    'public.get_comissao_couvert_periodo(integer, date, date)',
    'public.get_health_dashboard()',
    'public.listar_categorias_clientes_estatisticas(integer)',
    'public.top_clientes_por_categoria(integer, text, integer)',
    'public.set_produto_custo_manual(integer, text, text, numeric, numeric, text, text)',
    'silver.calcular_stockout_periodo(integer, date, date)'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY sigs LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', s);
  END LOOP;
END $$;
