-- Drop de 8 indices duplicados apontados pelo Supabase Performance Advisor.
-- Baseline: database/_advisor_snapshots/2026-04-24-perf.json (8 findings duplicate_index).
--
-- 4 dos drops (integrations.contaazul_*) SUPERSEDEM as seguintes linhas da
-- migration 20260324_contaazul_tables.sql, que criavam CREATE UNIQUE INDEX
-- redundantes sobre colunas ja cobertas pelo *_key backing index da UNIQUE constraint:
--
--   20260324_contaazul_tables.sql linhas 94-95   -> integrations.idx_contaazul_categorias_contaazul_id          (criada como public.*, move out-of-band para integrations.*)
--   20260324_contaazul_tables.sql linhas 117-118 -> integrations.idx_contaazul_centros_custo_contaazul_id       (idem)
--   20260324_contaazul_tables.sql linhas 169-170 -> integrations.idx_contaazul_contas_financeiras_contaazul_id  (idem)
--   20260324_contaazul_tables.sql linhas 143-144 -> integrations.idx_contaazul_pessoas_contaazul_id             (idem)
--
-- NOTA #7 (integrations.contaazul_lancamentos): o drop NAO supersede linha
-- da migration 20260324. O indice original criado em 20260324 linhas 66-67
-- (idx_contaazul_lancamentos_contaazul_id, single-column em contaazul_id)
-- ja foi substituido por um UNIQUE composite (contaazul_id, bar_id) out-of-band,
-- sem migration comitada no repo. O par duplicado atual e:
--   keep:  contaazul_lancamentos_contaazul_id_bar_id_key (backing da UNIQUE CONSTRAINT)
--   drop:  idx_contaazul_lancamentos_contaazul_id_bar_id (duplicata manual)
-- TODO: investigar quando/por que virou composite. Provavelmente regra de
-- negocio permitindo o mesmo contaazul_id em bares diferentes (bar_id=3 e
-- bar_id=4 do Ordinario/Deboche). Follow-up fora do escopo desta migration.
--
-- Convencao de migrations e append-only; a 20260324 NAO foi editada.
-- Em fresh env, a sequencia natural aplica e depois dropa - fim identico a prod.
--
-- Os 3 drops bronze.idx_bronze_sympla_* sao duplicatas sem base em migration
-- comitada (provavelmente criados ad-hoc). Criterio de keep: consistencia pt-BR
-- com o resto do schema bronze (idx_*_evento, idx_*_data).
--
-- DROP INDEX CONCURRENTLY nao pode rodar dentro de transaction block.
-- Aplicar via mcp__supabase__execute_sql um statement por vez, ou via psql
-- com autocommit. Nunca envelope em BEGIN/COMMIT.

-- ============================================
-- bronze.bronze_sympla_participantes
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_sympla_part_event;

-- ============================================
-- bronze.bronze_sympla_pedidos
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_sympla_pedidos_date;
DROP INDEX CONCURRENTLY IF EXISTS bronze.idx_bronze_sympla_pedidos_event;

-- ============================================
-- integrations.contaazul_categorias
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_categorias_contaazul_id;

-- ============================================
-- integrations.contaazul_centros_custo
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_centros_custo_contaazul_id;

-- ============================================
-- integrations.contaazul_contas_financeiras
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_contas_financeiras_contaazul_id;

-- ============================================
-- integrations.contaazul_lancamentos
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_lancamentos_contaazul_id_bar_id;

-- ============================================
-- integrations.contaazul_pessoas
-- ============================================
DROP INDEX CONCURRENTLY IF EXISTS integrations.idx_contaazul_pessoas_contaazul_id;
