-- Capacidade/dia passa da COLUNA operations.bares.capacidade_dia para o config jsonb
-- (config.capacidade_dia). Motivo: a tela Config→Bares salva o `config` jsonb (merge),
-- então a edição da capacidade funciona sem alterar a API de save. Fonte única = config.
-- A Taxa de Lotação (/api/receitas/lotacao) passa a ler config->>'capacidade_dia'.
-- Aplicada em produção via MCP em 2026-07-08 (supersede a 2026-07-08-capacidade-dia-operations-bares.sql).
UPDATE operations.bares
SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{capacidade_dia}', to_jsonb(capacidade_dia))
WHERE capacidade_dia IS NOT NULL;

ALTER TABLE operations.bares DROP COLUMN IF EXISTS capacidade_dia;
