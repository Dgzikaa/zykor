-- Rollback de 2026-04-26-perf05-unused-indexes-batch2.sql.
-- Recria 9 indexes com indexdef fiel ao snapshot capturado em 2026-04-26.
-- Partials (WHERE clauses) preservados exatamente.
--
-- CREATE INDEX CONCURRENTLY: nao pode rodar em transaction block.
-- Aplicar via execute_sql um statement por vez.
--
-- ATENCAO: 88 dias de stats = 0 scans em cada index. Recriacao deve
-- acontecer apenas se observarmos degradacao mensuravel atribuivel ao
-- drop deste batch. Cuidado especial com:
-- - cliente_visitas/cliente_estatisticas: source of truth operacional
--   (DOMAIN_MAP). Se alguma feature comecar a usar cli_id_contahub,
--   recriar antes do rollout.
-- - gold.planejamento.precisa_recalculo: se o refactor 2026-04-20
--   evoluir pra usar precisa_recalculo na gold (em vez de eventos_base),
--   recriar.

-- ============================================
-- silver (8 indexes)
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cliente_visitas_cli_id
  ON silver.cliente_visitas
  USING btree (bar_id, cli_id_contahub) WHERE (cli_id_contahub IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cliente_estatisticas_cli_id
  ON silver.cliente_estatisticas
  USING btree (bar_id, cli_id_contahub) WHERE (cli_id_contahub IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservantes_perfil_segmento
  ON silver.reservantes_perfil
  USING btree (bar_id, segmento_reserva);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservantes_perfil_vip
  ON silver.reservantes_perfil
  USING btree (bar_id, is_vip) WHERE (is_vip = true);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stockout_proc_motivo
  ON silver.silver_contahub_operacional_stockout_processado
  USING btree (motivo_exclusao) WHERE (motivo_exclusao IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yuzer_produtos_evento_produto
  ON silver.yuzer_produtos_evento
  USING btree (bar_id, produto_nome);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_produtos_top_categoria
  ON silver.produtos_top
  USING btree (bar_id, categoria) WHERE (categoria IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sympla_bilheteria_event_id
  ON silver.sympla_bilheteria_diaria
  USING btree (bar_id, event_id) WHERE (event_id IS NOT NULL);

-- ============================================
-- gold (1 index)
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_planejamento_comercial_diario_recalculo
  ON gold.planejamento
  USING btree (precisa_recalculo) WHERE (precisa_recalculo = true);
