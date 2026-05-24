-- ============================================================================
-- Migration: Adicionar 'cmv' ao CHECK constraint de meta.metas_desempenho.periodo
-- Data: 2026-05-21
-- Motivo: API /api/cmv-semanal/metas insere periodo='cmv' (metas de Gestao CMV
--         reusam essa tabela). CHECK antigo so permitia 'semanal'/'mensal' e
--         todo INSERT falhava silenciosamente — socio relatou "aperta salvar
--         e nao salva". cmv_teorico ficava travado em 29% (default) porque
--         a meta nunca era persistida.
-- ============================================================================

ALTER TABLE meta.metas_desempenho
  DROP CONSTRAINT IF EXISTS metas_desempenho_periodo_check;

ALTER TABLE meta.metas_desempenho
  ADD CONSTRAINT metas_desempenho_periodo_check
  CHECK (periodo IN ('semanal', 'mensal', 'cmv'));
