-- Hardening seguranca: 3 acoes seguras baseadas nos advisors do Supabase
-- 1) Habilitar RLS em backups recentes (api_credentials + 5 tabelas purge_2026_05_12)
-- 2) REVOKE EXECUTE FROM PUBLIC/anon nas funcoes que disparam efeitos colaterais
--    (Discord webhook, ETL, marcar excluídos). Mantem authenticated funcionando.
-- 3) service_role nao e afetado (superuser-like).

-- ============================================================================
-- 1) RLS em tabelas backup expostas via API
-- ============================================================================
ALTER TABLE integrations.api_credentials_backup_2026_05_11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.contaazul_lancamentos_bar4_purge_2026_05_12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.contaazul_pessoas_bar4_purge_2026_05_12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.contaazul_categorias_bar4_purge_2026_05_12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.contaazul_centros_custo_bar4_purge_2026_05_12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.contaazul_silver_lancamentos_bar4_purge_2026_05_12 ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2) REVOKE EXECUTE FROM PUBLIC/anon em funcoes SECURITY DEFINER perigosas
--    Mantem authenticated (uso legitimo pelo frontend logado).
-- ============================================================================
DO $$
DECLARE
  fn TEXT;
  fns TEXT[] := ARRAY[
    'public.alertar_data_freshness_discord()',
    'public.enviar_alerta_discord_sistema(p_titulo text, p_mensagem text, p_cor integer, p_bar_id integer)',
    'public.enviar_alerta_discord_sistema(p_titulo text, p_mensagem text, p_cor integer, p_bar_id integer, p_tipo text)',
    'public.enviar_alerta_discord_sistema_dedup(p_bar_id integer, p_tipo text, p_categoria text, p_titulo text, p_mensagem text, p_cor integer, p_dedupe_key text, p_canal text)',
    'public.etl_silver_inter_pix_diarios_all_bars()',
    'public.get_discord_webhook(p_tipo text)',
    'public.marcar_excluidos_contaazul(p_bar_id integer, p_tipo text, p_data_venc_de date, p_data_venc_ate date, p_ids_vindos uuid[])',
    'public.verificar_stockout_alto_alerta_discord(p_threshold numeric)',
    'system.alertar_porproduto_vs_diahora_discord()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
