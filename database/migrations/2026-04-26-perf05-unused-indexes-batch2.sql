-- perf/05 Batch 2 — DROP de 9 indexes unused em silver/gold (~16.5 MB)
--
-- ESCOPO: silver (8) + gold (1) — categoria operacional, exigiu pre-flight
-- redobrado (silver e source of truth para queries operacionais).
--
-- JANELA: server uptime de 88 dias (~3 meses de stats acumulados).
-- last_idx_scan = NULL em todos os 9 — nunca foram scanned desde boot.
--
-- PRE-FLIGHT REDOBRADO (Gate 1) — 4 vetores de validacao por index:
-- (a) Grep no codigo (frontend/backend/database/scripts) por colunas
--     indexadas
-- (b) Composite check em pg_indexes (outros indexes que cubram o mesmo padrao)
-- (c) pg_stat_statements check (queries reais que filtrem nas colunas)
-- (d) pg_stat_user_indexes idx_scan = 0 + last_idx_scan = NULL
--
-- TODOS os 9 confirmados dead em todos os 4 vetores. Insights:
-- - cli_id_contahub: ZERO callers em 12.2 MB combinados (cliente_visitas
--   + cliente_estatisticas). Feature fantasma — provavelmente era pra
--   "ID externo ContaHub" que nunca shippou.
-- - reservantes_perfil: 3 dos 5 indexes sem caller. is_vip confunde com
--   cliente_estatisticas.eh_vip (que TEM index e callers reais).
-- - gold.planejamento.precisa_recalculo: refactor 2026-04-20 migrou
--   queries pra gold.planejamento mas precisa_recalculo continua sendo
--   manipulado em operations.eventos_base. Index virou no-op em gold.
-- - yuzer.produto_nome: 8 callers usam JS-side filter
--   (produto_nome.toLowerCase().includes(...)) em vez de SQL WHERE.
--   SQL index em produto_nome puro nunca seria usado por padrao
--   substring-includes. Anotado como follow-up arquitetural.
--
-- ESPACO LIBERADO: ~16.5 MB.
--
-- APLICACAO: DROP INDEX CONCURRENTLY nao roda em transaction block.
-- Usar mcp__supabase__execute_sql um DROP por chamada (mesmo padrao
-- da Fase 1 / perf/01 / batch 1).
--
-- ROLLBACK: 9 CREATE INDEX CONCURRENTLY IF NOT EXISTS no
-- 2026-04-26-perf05-unused-indexes-batch2.rollback.sql, com indexdef
-- fiel (incluindo partials WHERE cli_id_contahub IS NOT NULL, etc).

-- ============================================
-- silver (8 indexes, ~16.5 MB)
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_cliente_visitas_cli_id;
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_cliente_estatisticas_cli_id;
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_reservantes_perfil_segmento;
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_reservantes_perfil_vip;
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_stockout_proc_motivo;
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_yuzer_produtos_evento_produto;
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_produtos_top_categoria;
DROP INDEX CONCURRENTLY IF EXISTS silver.idx_sympla_bilheteria_event_id;

-- ============================================
-- gold (1 index, 8 kB)
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS gold.idx_planejamento_comercial_diario_recalculo;
