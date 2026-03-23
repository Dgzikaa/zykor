-- ============================================================================
-- Migration: Metas de desempenho por semana
-- Data: 2026-03-23
-- Descrição: Adiciona semana/ano à tabela metas_desempenho para permitir
--            metas diferentes por semana. Quando semana IS NULL, é meta global.
--            Faturamento continua vindo do planejamento (M1).
-- ============================================================================

-- 1. Adicionar colunas semana e ano (nullable = meta global quando NULL)
ALTER TABLE metas_desempenho
  ADD COLUMN IF NOT EXISTS semana INTEGER,
  ADD COLUMN IF NOT EXISTS ano INTEGER;

-- 2. Dropar constraint unique antiga (bar_id, periodo, metrica)
--    e criar nova incluindo semana+ano
--    Usamos COALESCE para tratar NULL como 0 na unique constraint
ALTER TABLE metas_desempenho
  DROP CONSTRAINT IF EXISTS metas_desempenho_bar_id_periodo_metrica_key;

-- Criar unique index que trata NULLs corretamente
CREATE UNIQUE INDEX IF NOT EXISTS metas_desempenho_bar_periodo_metrica_semana_ano_idx
  ON metas_desempenho (bar_id, periodo, metrica, COALESCE(semana, 0), COALESCE(ano, 0));

-- 3. Índice para busca rápida por bar+semana+ano
CREATE INDEX IF NOT EXISTS metas_desempenho_bar_semana_ano_idx
  ON metas_desempenho (bar_id, ano, semana)
  WHERE semana IS NOT NULL;

-- 4. Atualizar historico para incluir semana/ano
ALTER TABLE metas_desempenho_historico
  ADD COLUMN IF NOT EXISTS semana INTEGER,
  ADD COLUMN IF NOT EXISTS ano INTEGER;

-- 5. Comentários
COMMENT ON COLUMN metas_desempenho.semana IS 'Número da semana ISO. NULL = meta global (usada como fallback)';
COMMENT ON COLUMN metas_desempenho.ano IS 'Ano ISO. NULL = meta global (usada como fallback)';
