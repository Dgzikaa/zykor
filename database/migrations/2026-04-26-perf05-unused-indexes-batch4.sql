-- perf/05 batch 4 — long tail (integrations + agent_ai + hr + crm + public)
-- Drops 22 indexes flagged como unused_index (idx_scan = 0 em janela de 87 dias).
-- Audit 4 vetores: grep código, composite check, pg_stat_statements, idx_scan/last_idx_scan.
--
-- Insights:
--   * idx_usuarios_bares_bar_id (RLS-critical table): 27891 calls all use prefix
--     da UNIQUE (usuario_id, bar_id) — função public.user_has_bar_access() faz
--     WHERE usuario_id=auth.uid() AND bar_id=check_bar_id. Standalone bar_id morto.
--   * contaazul_lancamentos partial WHERE valor_nao_pago > 0 (360 kB) — feature
--     existe (UI faz check de pagamentos pendentes) mas WHERE filter nunca usado;
--     queries reais usam (bar_id, tipo) ou (bar_id, data_competencia).
--   * contaazul_categorias e contaazul_centros_custo partials WHERE ativo=true —
--     mesmo padrão dos outros contaazul partials.
--   * idx_cmv_manual_bar_periodo (bar_id, periodo_inicio DESC) — redundante com
--     UNIQUE unique_cmv_periodo (bar_id, periodo_tipo, periodo_inicio).
--   * agent_insights_v2 (4 indexes em colunas standalone): tabela cobre via
--     idx_agent_insights_v2_bar_data (bar_id, data); colunas tipo/severidade/
--     visualizado/arquivado nunca filtradas isoladamente.
--   * hr (5 indexes em FKs): contratos_funcionario e funcionarios — JOINs e
--     queries filtram por bar_id, nunca por area_id/cargo_id/funcionario_id alone.
--
-- Apply mode: DROP INDEX CONCURRENTLY (não pode rodar dentro de transação).
-- Cada DROP aplicado individualmente via execute_sql, não apply_migration.

-- ===== integrations (7) =====
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_lancamentos_valor_nao_pago;
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_centros_custo_ativo;
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_categorias_tipo;
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_categorias_ativo;
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_pessoas_perfil;
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_pessoas_documento;
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_umbler_campanha_destinatarios_campanha_id_new;

-- ===== agent_ai (7) =====
DROP INDEX CONCURRENTLY IF EXISTS agent_ai.idx_agente_configuracoes_bar_id;
DROP INDEX CONCURRENTLY IF EXISTS agent_ai.idx_agente_insights_scan_id;
DROP INDEX CONCURRENTLY IF EXISTS agent_ai.idx_agent_insights_v2_visualizado;
DROP INDEX CONCURRENTLY IF EXISTS agent_ai.idx_agent_insights_v2_arquivado;
DROP INDEX CONCURRENTLY IF EXISTS agent_ai.idx_agent_insights_v2_tipo;
DROP INDEX CONCURRENTLY IF EXISTS agent_ai.idx_agent_insights_v2_severidade;
DROP INDEX CONCURRENTLY IF EXISTS agent_ai.idx_agente_alertas_insight_id;

-- ===== hr (5) =====
DROP INDEX CONCURRENTLY IF EXISTS hr.idx_funcionarios_cargo_id_new;
DROP INDEX CONCURRENTLY IF EXISTS hr.idx_funcionarios_area_id_new;
DROP INDEX CONCURRENTLY IF EXISTS hr.idx_provisoes_trabalhistas_funcionario_id_new;
DROP INDEX CONCURRENTLY IF EXISTS hr.idx_contratos_funcionario_area_id;
DROP INDEX CONCURRENTLY IF EXISTS hr.idx_contratos_funcionario_cargo_id;

-- ===== crm (1) =====
DROP INDEX CONCURRENTLY IF EXISTS crm.idx_nps_falae_diario_pesquisa_search;

-- ===== public (2) =====
DROP INDEX CONCURRENTLY IF EXISTS public.idx_usuarios_bares_bar_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_cmv_manual_bar_periodo;

-- Total esperado liberado: ~600 kB
-- Pós-DROP: VACUUM ANALYZE em tabelas afetadas.
