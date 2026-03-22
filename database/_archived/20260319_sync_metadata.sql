-- ============================================================
-- TABELA: sync_metadata
-- Baseline de estrutura esperada para planilhas Google Sheets
-- Usado para validação antes de escrita e detecção de schema drift
-- 
-- Executar via Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação da fonte
  bar_id integer REFERENCES bares(id),
  sync_type text NOT NULL,
  spreadsheet_id text,
  sheet_name text,
  
  -- Baseline de estrutura
  expected_headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  min_rows integer NOT NULL DEFAULT 10,
  min_columns integer NOT NULL DEFAULT 3,
  
  -- Estatísticas do último sync bem-sucedido
  last_sync_at timestamptz,
  last_row_count integer,
  last_column_count integer,
  last_headers jsonb,
  
  -- Controle
  is_active boolean NOT NULL DEFAULT true,
  allow_fewer_rows boolean NOT NULL DEFAULT false,
  row_decrease_threshold numeric(5,2) DEFAULT 0.20,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT sync_metadata_unique UNIQUE (bar_id, sync_type, spreadsheet_id, sheet_name)
);

CREATE INDEX IF NOT EXISTS idx_sync_metadata_bar_type ON sync_metadata(bar_id, sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_metadata_active ON sync_metadata(is_active) WHERE is_active = true;

COMMENT ON TABLE sync_metadata IS 'Baseline de estrutura esperada para validação de planilhas Google Sheets antes de ingestão';

CREATE OR REPLACE FUNCTION update_sync_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_metadata_updated ON sync_metadata;
CREATE TRIGGER trg_sync_metadata_updated
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_metadata_timestamp();
