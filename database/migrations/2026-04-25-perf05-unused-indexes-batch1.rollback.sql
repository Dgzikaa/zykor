-- Rollback de 2026-04-25-perf05-unused-indexes-batch1.sql.
-- Recria os 14 indexes droppados com indexdef fiel ao snapshot
-- de pg_indexes capturado em 2026-04-25.
--
-- IMPORTANTE: indexdef original do Postgres NAO inclui CONCURRENTLY.
-- Adicionado aqui pra evitar lock pesado em re-criacao em prod (ha
-- escrita constante nas tabelas bronze de cron jobs de ingestao).
--
-- CREATE INDEX CONCURRENTLY tambem nao pode rodar em transaction block —
-- aplicar via execute_sql um statement por vez (mesmo padrao da Fase 1
-- rollback).
--
-- ATENCAO: este rollback nao e gatilho automatico — so executar se
-- observarmos degradacao mensuravel atribuivel ao drop deste batch.
-- 87 dias de stats = 0 scans torna improvavel que a recriacao seja
-- necessaria, mas mantida pra fidelidade.

-- ============================================
-- bronze (13 indexes)
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contahub_pagamentos_cli_fone
  ON bronze.bronze_contahub_financeiro_pagamentosrecebidos
  USING btree (cli_fone) WHERE (cli_fone IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_ca_lanc_cc
  ON bronze.bronze_contaazul_lancamentos
  USING btree (centro_custo_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_umbler_msg_enviada
  ON bronze.bronze_umbler_mensagens
  USING btree (bar_id, enviada_em DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_ca_lanc_cat
  ON bronze.bronze_contaazul_lancamentos
  USING btree (categoria_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_sympla_part_order
  ON bronze.bronze_sympla_participantes
  USING btree (order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_umbler_msg_conversa
  ON bronze.bronze_umbler_mensagens
  USING btree (conversa_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_sympla_part_email
  ON bronze.bronze_sympla_participantes
  USING btree (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_sympla_pedidos_email
  ON bronze.bronze_sympla_pedidos
  USING btree (buyer_email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_umbler_msg_telefone
  ON bronze.bronze_umbler_mensagens
  USING btree (contato_telefone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_umbler_conv_telefone
  ON bronze.bronze_umbler_conversas
  USING btree (contato_telefone);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contahub_pagamentos_cli_cpf
  ON bronze.bronze_contahub_financeiro_pagamentosrecebidos
  USING btree (cli_cpf) WHERE (cli_cpf IS NOT NULL);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_sympla_pedidos_data
  ON bronze.bronze_sympla_pedidos
  USING btree (order_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bronze_umbler_conv_ult_msg
  ON bronze.bronze_umbler_conversas
  USING btree (bar_id, ultima_mensagem_em DESC);

-- ============================================
-- system (1 index)
-- ============================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_trail_table_record
  ON system.audit_trail
  USING btree (table_name, record_id);
