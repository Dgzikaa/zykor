-- Migration: Criar tabela tempos_producao
-- Data: 2026-03-20

CREATE TABLE IF NOT EXISTS tempos_producao (
  id              BIGSERIAL PRIMARY KEY,
  bar_id          INTEGER NOT NULL REFERENCES bares(id),
  data_producao   DATE NOT NULL,
  produto_codigo  INTEGER,
  produto_desc    TEXT,
  grupo_desc      TEXT,
  local_desc      TEXT,
  categoria       TEXT,
  t0_lancamento   TIMESTAMP,
  t1_prodini      TIMESTAMP,
  t2_prodfim      TIMESTAMP,
  t3_entrega      TIMESTAMP,
  t0_t1           NUMERIC(10,1) DEFAULT 0,
  t0_t2           NUMERIC(10,1) DEFAULT 0,
  t0_t3           NUMERIC(10,1) DEFAULT 0,
  t1_t2           NUMERIC(10,1) DEFAULT 0,
  t2_t3           NUMERIC(10,1) DEFAULT 0,
  quantidade      INTEGER DEFAULT 1,
  origem          VARCHAR(20) NOT NULL DEFAULT 'contahub',
  origem_ref      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tempos_producao_bar_data ON tempos_producao (bar_id, data_producao);
CREATE INDEX IF NOT EXISTS idx_tempos_producao_categoria ON tempos_producao (bar_id, data_producao, local_desc, categoria);
CREATE INDEX IF NOT EXISTS idx_tempos_producao_dedup ON tempos_producao (bar_id, data_producao, origem);

COMMENT ON TABLE tempos_producao IS 'Tabela de dominio para tempos de producao - source of truth';
