-- ROLLBACK perf/05 batch 4 — long tail unused_indexes
-- Recria os 22 índices na configuração exata pré-DROP (extraída de pg_indexes em 2026-04-26).

-- ===== integrations =====
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contaazul_lancamentos_valor_nao_pago
  ON integrations.contaazul_lancamentos USING btree (valor_nao_pago)
  WHERE (valor_nao_pago > (0)::numeric);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contaazul_centros_custo_ativo
  ON integrations.contaazul_centros_custo USING btree (ativo)
  WHERE (ativo = true);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contaazul_categorias_tipo
  ON integrations.contaazul_categorias USING btree (tipo);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contaazul_categorias_ativo
  ON integrations.contaazul_categorias USING btree (ativo)
  WHERE (ativo = true);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contaazul_pessoas_perfil
  ON integrations.contaazul_pessoas USING btree (perfil);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contaazul_pessoas_documento
  ON integrations.contaazul_pessoas USING btree (documento);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_umbler_campanha_destinatarios_campanha_id_new
  ON integrations.umbler_campanha_destinatarios USING btree (campanha_id);

-- ===== agent_ai =====
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agente_configuracoes_bar_id
  ON agent_ai.agente_configuracoes USING btree (bar_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agente_insights_scan_id
  ON agent_ai.agente_insights USING btree (scan_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_insights_v2_visualizado
  ON agent_ai.agent_insights_v2 USING btree (visualizado);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_insights_v2_arquivado
  ON agent_ai.agent_insights_v2 USING btree (arquivado);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_insights_v2_tipo
  ON agent_ai.agent_insights_v2 USING btree (tipo);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_insights_v2_severidade
  ON agent_ai.agent_insights_v2 USING btree (severidade);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agente_alertas_insight_id
  ON agent_ai.agente_alertas USING btree (insight_id);

-- ===== hr =====
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funcionarios_cargo_id_new
  ON hr.funcionarios USING btree (cargo_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funcionarios_area_id_new
  ON hr.funcionarios USING btree (area_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_provisoes_trabalhistas_funcionario_id_new
  ON hr.provisoes_trabalhistas USING btree (funcionario_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contratos_funcionario_area_id
  ON hr.contratos_funcionario USING btree (area_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contratos_funcionario_cargo_id
  ON hr.contratos_funcionario USING btree (cargo_id);

-- ===== crm =====
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nps_falae_diario_pesquisa_search
  ON crm.nps_falae_diario_pesquisa USING btree (search_name);

-- ===== public =====
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_bares_bar_id
  ON public.usuarios_bares USING btree (bar_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cmv_manual_bar_periodo
  ON public.cmv_manual USING btree (bar_id, periodo_inicio DESC);
