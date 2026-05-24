-- ============================================================================
-- Migration: cmv_teorico_percentual_manual em cmv_semanal e cmv_mensal
-- Data: 2026-05-24
-- Motivo: A coluna cmv_teorico_percentual original e' populada pelo ETL/sync
--         da planilha com o valor calculado do CMV Limpo (na pratica viraram
--         a mesma coisa — semana 18 mostrava teorico=27.61% = limpo=27.61%).
--         Usar essa coluna como destino de input manual nao funciona: o
--         proximo sync sobrescreve. Coluna *_manual e' separada e ignorada
--         pelo ETL — fonte unica de verdade pra edicao do socio. UI cai pra
--         meta global (meta.metas_desempenho periodo='cmv', metrica=
--         'cmv_teorico_percentual') quando manual e' NULL.
-- ============================================================================

ALTER TABLE financial.cmv_semanal
  ADD COLUMN IF NOT EXISTS cmv_teorico_percentual_manual NUMERIC(8,4) NULL;

ALTER TABLE financial.cmv_mensal
  ADD COLUMN IF NOT EXISTS cmv_teorico_percentual_manual NUMERIC(8,4) NULL;

COMMENT ON COLUMN financial.cmv_semanal.cmv_teorico_percentual_manual IS
  'CMV Teorico (%) editado manualmente pelo socio. NULL = usa meta global como fallback. Nao e tocado pelo sync da planilha.';
COMMENT ON COLUMN financial.cmv_mensal.cmv_teorico_percentual_manual IS
  'CMV Teorico (%) editado manualmente pelo socio. NULL = usa meta global como fallback. Nao e tocado pelo sync da planilha.';
