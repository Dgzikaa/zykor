-- Ação A do hardening 100%: REVOKE authenticated de funções de side-effect.
-- Validado via grep que nenhuma é chamada via supabase.rpc() no Next.js.
-- Service_role mantém acesso (chamadas via pg_cron e edge functions).
DO $$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'public.enviar_alerta_discord_sistema(p_titulo text, p_mensagem text, p_cor integer, p_bar_id integer)',
    'public.enviar_alerta_discord_sistema(p_titulo text, p_mensagem text, p_cor integer, p_bar_id integer, p_tipo text)',
    'public.enviar_alerta_discord_sistema_dedup(p_bar_id integer, p_tipo text, p_categoria text, p_titulo text, p_mensagem text, p_cor integer, p_dedupe_key text, p_canal text)',
    'public.alertar_data_freshness_discord()',
    'system.alertar_porproduto_vs_diahora_discord()',
    'public.verificar_stockout_alto_alerta_discord(p_threshold numeric)',
    'public.get_discord_webhook(p_tipo text)',
    'public.etl_silver_inter_pix_diarios_all_bars()',
    'public.marcar_excluidos_contaazul(p_bar_id integer, p_tipo text, p_data_venc_de date, p_data_venc_ate date, p_ids_vindos uuid[])',
    'public.executar_recalculo_desempenho_v2()',
    'public.silver_atualizar_bebida_comida_favorita(p_bar_id integer)',
    'public.silver_atualizar_cadastro_clientes_contahub(p_bar_id integer)',
    'public.silver_atualizar_horarios_vendas_periodo(p_bar_id integer)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;
