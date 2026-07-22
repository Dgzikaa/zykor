-- Motivo da pausa das produções em andamento (Controle de Produção → aba Executar).
--
-- Coluna SEPARADA do `estado` (jsonb do snapshot do cliente) de propósito: o autosave da pessoa
-- (PUT do rascunho) não inclui obs_pausa, então nunca a sobrescreve. Assim tanto a pessoa da
-- produção quanto o gestor podem anotar o motivo (de qualquer aparelho) sem conflito, e o realtime
-- da tabela propaga pra todos.
--
-- Formato: { motivos: string[], texto: string, autor: string|null, em: timestamptz }
-- Escrita: POST /api/operacional/producoes/execucao/rascunho/observacao
-- Já aplicado em produção (idempotente).

alter table operations.producao_execucao_rascunho
  add column if not exists obs_pausa jsonb;
