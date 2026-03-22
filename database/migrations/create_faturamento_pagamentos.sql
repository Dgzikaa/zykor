-- Migration: Criar tabela faturamento_pagamentos
-- Data: 2026-03-20
-- Nota: Nome alterado de "pagamentos" pois ja existia tabela legada

CREATE TABLE IF NOT EXISTS faturamento_pagamentos (
  id              BIGSERIAL PRIMARY KEY,
  bar_id          INTEGER NOT NULL REFERENCES bares(id),
  data_pagamento  DATE NOT NULL,
  meio            TEXT,
  tipo            TEXT,
  valor_bruto     NUMERIC(12,2) DEFAULT 0,
  taxa            NUMERIC(12,2) DEFAULT 0,
  valor_liquido   NUMERIC(12,2) DEFAULT 0,
  cliente_nome    TEXT,
  mesa_desc       TEXT,
  origem          VARCHAR(20) NOT NULL DEFAULT 'contahub',
  origem_ref      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faturamento_pagamentos_bar_data ON faturamento_pagamentos (bar_id, data_pagamento);
CREATE INDEX IF NOT EXISTS idx_faturamento_pagamentos_meio ON faturamento_pagamentos (bar_id, data_pagamento, meio);
CREATE INDEX IF NOT EXISTS idx_faturamento_pagamentos_dedup ON faturamento_pagamentos (bar_id, data_pagamento, origem);

COMMENT ON TABLE faturamento_pagamentos IS 'Tabela de dominio para pagamentos diarios - source of truth';
