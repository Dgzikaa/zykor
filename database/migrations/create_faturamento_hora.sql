-- Migration: Criar tabela faturamento_hora
-- Data: 2026-03-20

CREATE TABLE IF NOT EXISTS faturamento_hora (
  id              BIGSERIAL PRIMARY KEY,
  bar_id          INTEGER NOT NULL REFERENCES bares(id),
  data_venda      DATE NOT NULL,
  hora            INTEGER NOT NULL,
  quantidade      NUMERIC(10,2) DEFAULT 0,
  valor           NUMERIC(12,2) DEFAULT 0,
  origem          VARCHAR(20) NOT NULL DEFAULT 'contahub',
  origem_ref      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faturamento_hora_bar_data ON faturamento_hora (bar_id, data_venda);
CREATE INDEX IF NOT EXISTS idx_faturamento_hora_dedup ON faturamento_hora (bar_id, data_venda, origem);

COMMENT ON TABLE faturamento_hora IS 'Tabela de dominio para faturamento por hora - source of truth';
