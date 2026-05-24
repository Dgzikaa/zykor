-- ============================================================================
-- Migration: meta.cmo_manual
-- Data: 2026-05-21
-- Descricao: Armazena os inputs manuais que entram no CMO (Custo de Mao-de-Obra)
--            do Desempenho. As outras 2 categorias do CMO (Freelas e Alimentacao)
--            sao automaticas (ContaAzul e CMA, respectivamente) — so Equipe Fixa
--            e Pro Labore precisam de input.
--
-- Por bar/ano/mes: socio pode ajustar mes a mes (reajustes salariais, contratacoes).
-- Pro Labore: valor mensal. Visao semanal rateia por dias do mes × 7.
-- ============================================================================

CREATE TABLE IF NOT EXISTS meta.cmo_manual (
  id SERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL REFERENCES operations.bares(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  equipe_fixa_mensal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  pro_labore_mensal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bar_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS cmo_manual_bar_periodo_idx
  ON meta.cmo_manual (bar_id, ano, mes);

-- RLS: usuarios so veem dados dos bares que pertencem
ALTER TABLE meta.cmo_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their bar data" ON meta.cmo_manual
  USING (bar_id IN (
    SELECT usuarios_bares.bar_id FROM public.usuarios_bares
    WHERE usuarios_bares.usuario_id = (SELECT auth.uid())
  ))
  WITH CHECK (bar_id IN (
    SELECT usuarios_bares.bar_id FROM public.usuarios_bares
    WHERE usuarios_bares.usuario_id = (SELECT auth.uid())
  ));

COMMENT ON TABLE meta.cmo_manual IS 'Inputs manuais de Equipe Fixa e Pro Labore que compoem o CMO mensal por bar';
COMMENT ON COLUMN meta.cmo_manual.equipe_fixa_mensal IS 'Folha de pagamento mensal da equipe fixa (R$). Editavel pelo socio.';
COMMENT ON COLUMN meta.cmo_manual.pro_labore_mensal IS 'Pro Labore mensal dos socios (R$). Visao semanal rateia por dias do mes × 7.';
