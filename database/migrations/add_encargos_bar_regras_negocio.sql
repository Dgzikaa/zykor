-- Migration: Adiciona colunas de encargos trabalhistas em bar_regras_negocio
-- Data: 2026-03-20

ALTER TABLE bar_regras_negocio ADD COLUMN IF NOT EXISTS fgts_percentual NUMERIC(5,2) DEFAULT 8.00;
ALTER TABLE bar_regras_negocio ADD COLUMN IF NOT EXISTS inss_patronal_percentual NUMERIC(5,2) DEFAULT 20.00;
UPDATE bar_regras_negocio SET fgts_percentual = 8.00, inss_patronal_percentual = 20.00 WHERE fgts_percentual IS NULL;
