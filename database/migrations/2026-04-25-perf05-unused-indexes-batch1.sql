-- perf/05 Batch 1 — DROP de 14 indexes unused (zero idx_scan em 87 dias)
--
-- ESCOPO: bronze (13) + system (1) — categorias de menor risco (raw data
-- + audit logs). silver/gold/operations/financial/integrations ficam pra
-- batches 2-N quando tivermos mais confianca no padrao.
--
-- JANELA: server uptime de 87 dias (started 2026-01-28). Stats acumulando
-- desde entao. Top index com idx_scan=47M prova que tracking esta ativo.
-- Verificacao realtime imediatamente antes da geracao desta migration:
-- 14/14 candidatos ainda com idx_scan=0.
--
-- HEURISTICA "why-no-scan":
-- - bronze.* sao raw data, staging descartavel. Queries reais consomem
--   silver.* / integrations.*. Indexes em bronze.bronze_umbler_mensagens
--   por telefone, conversa_id, contato_telefone, etc. nunca foram usados —
--   queries reais usam integrations.umbler_mensagens.
-- - bronze.bronze_contahub_financeiro_pagamentosrecebidos.idx_contahub_pagamentos_cli_*
--   (cli_fone, cli_cpf): lookup CRM por telefone/cpf vai pra silver.cliente_visitas
--   ou crm.*, nunca bronze.
-- - bronze.bronze_sympla_*: idem — frontend usa integrations.sympla_*.
-- - bronze.bronze_contaazul_lancamentos.idx_bronze_ca_lanc_{cat,cc}:
--   lookups por categoria/centro de custo vao pra integrations.contaazul_lancamentos.
-- - system.audit_trail.idx_audit_trail_table_record: audit nao tem queries
--   por (table_name, record_id) hoje — leitura e raramente, sem filtro.
--
-- ESPACO LIBERADO: ~22.7 MB (bronze) + 760 kB (system) = ~23.4 MB.
--
-- APLICACAO: DROP INDEX CONCURRENTLY nao roda em transaction block.
-- apply_migration empacota em BEGIN/COMMIT — vai falhar com erro 25001.
-- Usar mcp__supabase__execute_sql um DROP por chamada (mesmo padrao
-- da Fase 1 / perf/01).
--
-- ROLLBACK: 14 CREATE INDEX CONCURRENTLY IF NOT EXISTS no
-- 2026-04-25-perf05-unused-indexes-batch1.rollback.sql, com indexdef
-- fiel extraido de pg_indexes (whithout CONCURRENTLY no original; adicionado
-- no rollback pra evitar lock pesado em re-criacao).

-- ============================================
-- bronze (13 indexes, ~22.7 MB)
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_contahub_pagamentos_cli_fone;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_ca_lanc_cc;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_umbler_msg_enviada;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_ca_lanc_cat;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_sympla_part_order;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_umbler_msg_conversa;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_sympla_part_email;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_sympla_pedidos_email;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_umbler_msg_telefone;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_umbler_conv_telefone;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_contahub_pagamentos_cli_cpf;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_sympla_pedidos_data;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_umbler_conv_ult_msg;

-- ============================================
-- system (1 index, 760 kB)
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS system.idx_audit_trail_table_record;
