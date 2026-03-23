-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Criar tabela domain "visitas"
-- A v4.0 mudou todas as APIs para usar "visitas" mas a tabela nunca foi criada
-- Esta migration cria a tabela e popula com dados existentes de contahub_periodo
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Criar tabela visitas (domain table)
CREATE TABLE IF NOT EXISTS public.visitas (
  id BIGSERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL REFERENCES bares_config(bar_id),
  data_visita DATE NOT NULL,
  cliente_nome TEXT,
  cliente_fone TEXT,
  cliente_email TEXT,
  cliente_dtnasc DATE,
  pessoas NUMERIC DEFAULT 1,
  valor_pagamentos NUMERIC DEFAULT 0,
  valor_consumo NUMERIC DEFAULT 0,
  valor_produtos NUMERIC DEFAULT 0,
  valor_couvert NUMERIC DEFAULT 0,
  valor_desconto NUMERIC DEFAULT 0,
  valor_repique NUMERIC DEFAULT 0,
  mesa_desc TEXT,
  hora_abertura TEXT,
  motivo_desconto TEXT,
  tempo_estadia_minutos NUMERIC,
  origem VARCHAR(30) DEFAULT 'contahub',
  origem_ref BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bar_id, origem, origem_ref)
);

-- 2. Indices para performance
CREATE INDEX IF NOT EXISTS idx_visitas_bar_id ON visitas(bar_id);
CREATE INDEX IF NOT EXISTS idx_visitas_data_visita ON visitas(data_visita);
CREATE INDEX IF NOT EXISTS idx_visitas_bar_data ON visitas(bar_id, data_visita);
CREATE INDEX IF NOT EXISTS idx_visitas_cliente_fone ON visitas(cliente_fone);
CREATE INDEX IF NOT EXISTS idx_visitas_cliente_nome ON visitas(cliente_nome);

-- 3. RLS
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitas_select" ON visitas;
CREATE POLICY "visitas_select" ON visitas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "visitas_service_all" ON visitas;
CREATE POLICY "visitas_service_all" ON visitas
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Popular com dados existentes de contahub_periodo
INSERT INTO visitas (
  bar_id,
  data_visita,
  cliente_nome,
  cliente_fone,
  cliente_email,
  cliente_dtnasc,
  pessoas,
  valor_pagamentos,
  valor_consumo,
  valor_produtos,
  valor_couvert,
  valor_desconto,
  valor_repique,
  mesa_desc,
  hora_abertura,
  motivo_desconto,
  origem,
  origem_ref,
  created_at
)
SELECT
  cp.bar_id,
  cp.dt_gerencial,
  cp.cli_nome,
  cp.cli_fone,
  cp.cli_email,
  cp.cli_dtnasc,
  COALESCE(cp.pessoas, 1),
  COALESCE(cp.vr_pagamentos, 0),
  COALESCE(cp.vr_pagamentos, 0) - COALESCE(cp.vr_couvert, 0),
  COALESCE(cp.vr_produtos, 0),
  COALESCE(cp.vr_couvert, 0),
  COALESCE(cp.vr_desconto, 0),
  COALESCE(cp.vr_repique, 0),
  cp.vd_mesadesc,
  NULL, -- hora_abertura nao disponivel em contahub_periodo
  cp.motivo,
  'contahub',
  cp.id,
  COALESCE(cp.created_at, now())
FROM contahub_periodo cp
ON CONFLICT (bar_id, origem, origem_ref) DO NOTHING;

-- 5. Popular tempo_estadia_minutos de contahub_vendas (onde disponivel)
UPDATE visitas v
SET tempo_estadia_minutos = cv.tempo_estadia_minutos
FROM contahub_vendas cv
WHERE v.bar_id = cv.bar_id
  AND v.cliente_fone = cv.cli_fone
  AND v.data_visita = cv.dt_gerencial
  AND cv.tempo_estadia_minutos > 0
  AND cv.tempo_estadia_minutos < 720;

-- 6. Recriar view cliente_visitas
CREATE OR REPLACE VIEW public.cliente_visitas AS
SELECT id, bar_id, cliente_nome, cliente_fone AS cliente_telefone, created_at
FROM visitas
WHERE cliente_nome IS NOT NULL;

-- Pronto! A tabela visitas agora existe com todos os dados mapeados de contahub_periodo
