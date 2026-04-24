-- Smoke test para 2026-04-24-perf-drop-duplicate-indexes.sql.
-- Roda APOS aplicar a migration. Cada bloco deve retornar o resultado afirmado.

-- ============================================
-- 1. Os 8 indices droppados nao existem mais.
-- Esperado: count = 0.
-- ============================================
SELECT count(*) AS indices_remanescentes_de_droppados
FROM pg_indexes
WHERE schemaname || '.' || indexname IN (
    'bronze.idx_bronze_sympla_part_event',
    'bronze.idx_bronze_sympla_pedidos_date',
    'bronze.idx_bronze_sympla_pedidos_event',
    'integrations.idx_contaazul_categorias_contaazul_id',
    'integrations.idx_contaazul_centros_custo_contaazul_id',
    'integrations.idx_contaazul_contas_financeiras_contaazul_id',
    'integrations.idx_contaazul_lancamentos_contaazul_id_bar_id',
    'integrations.idx_contaazul_pessoas_contaazul_id'
);

-- ============================================
-- 2. Os 8 indices keep ainda existem (sanity check).
-- Esperado: count = 8.
-- ============================================
SELECT count(*) AS indices_keep_presentes
FROM pg_indexes
WHERE schemaname || '.' || indexname IN (
    'bronze.idx_bronze_sympla_part_evento',
    'bronze.idx_bronze_sympla_pedidos_data',
    'bronze.idx_bronze_sympla_pedidos_evento',
    'integrations.contaazul_categorias_contaazul_id_key',
    'integrations.contaazul_centros_custo_contaazul_id_key',
    'integrations.contaazul_contas_financeiras_contaazul_id_key',
    'integrations.contaazul_lancamentos_contaazul_id_bar_id_key',
    'integrations.contaazul_pessoas_contaazul_id_key'
);

-- ============================================
-- 3. EXPLAIN representativo: lookup em integrations.contaazul_lancamentos
-- por (contaazul_id, bar_id) — tipo de query que antes podia escolher entre
-- o `_key` ou o `idx_*` duplicado. Agora deve usar o `_key` backing.
-- Esperado: Index Scan/Index Only Scan usando contaazul_lancamentos_contaazul_id_bar_id_key.
-- ============================================
EXPLAIN (FORMAT TEXT)
SELECT id
FROM integrations.contaazul_lancamentos
WHERE contaazul_id = '00000000-0000-0000-0000-000000000000'::uuid
  AND bar_id = 3
LIMIT 1;
