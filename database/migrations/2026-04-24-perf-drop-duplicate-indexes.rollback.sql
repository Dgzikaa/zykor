-- Rollback de 2026-04-24-perf-drop-duplicate-indexes.sql.
-- Recria os 8 indices droppados com indexdef fiel ao snapshot
-- database/_advisor_snapshots/2026-04-24-pg-indexes-before.json.
--
-- ATENCAO: nos 5 contaazul, o indexdef original e CREATE UNIQUE INDEX (nao
-- CREATE INDEX). Mantido fiel ao baseline.
--
-- CREATE INDEX CONCURRENTLY tambem nao pode rodar em transaction block.
-- Aplicar um statement por vez, sem BEGIN/COMMIT.

-- ============================================
-- bronze.bronze_sympla_participantes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bronze_sympla_part_event
    ON bronze.bronze_sympla_participantes USING btree (bar_id, event_id);

-- ============================================
-- bronze.bronze_sympla_pedidos
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bronze_sympla_pedidos_date
    ON bronze.bronze_sympla_pedidos USING btree (order_date);

CREATE INDEX IF NOT EXISTS idx_bronze_sympla_pedidos_event
    ON bronze.bronze_sympla_pedidos USING btree (bar_id, event_id);

-- ============================================
-- integrations.contaazul_categorias
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_categorias_contaazul_id
    ON integrations.contaazul_categorias USING btree (contaazul_id);

-- ============================================
-- integrations.contaazul_centros_custo
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_centros_custo_contaazul_id
    ON integrations.contaazul_centros_custo USING btree (contaazul_id);

-- ============================================
-- integrations.contaazul_contas_financeiras
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_contas_financeiras_contaazul_id
    ON integrations.contaazul_contas_financeiras USING btree (contaazul_id);

-- ============================================
-- integrations.contaazul_lancamentos
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_lancamentos_contaazul_id_bar_id
    ON integrations.contaazul_lancamentos USING btree (contaazul_id, bar_id);

-- ============================================
-- integrations.contaazul_pessoas
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_contaazul_pessoas_contaazul_id
    ON integrations.contaazul_pessoas USING btree (contaazul_id);
