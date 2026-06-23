-- ============================================================================
-- gold.notas_fiscais_diaria — adiciona split por tipo de nota (NFCe x NFe)
-- ----------------------------------------------------------------------------
-- A maioria das notas é NFCe (consumidor), mas há NFe (B2B). A consolidação
-- diária passa a expor o total e a quantidade por tipo, mantendo o total geral.
-- Colunas novas vão no FIM (regra do CREATE OR REPLACE VIEW).
-- ============================================================================
CREATE OR REPLACE VIEW gold.notas_fiscais_diaria
WITH (security_invoker = true) AS
SELECT
  s.bar_id,
  s.nf_dtcontabil                                   AS data,
  s.cnpj_indice,
  COALESCE(l.label, 'CNPJ ' || s.cnpj_indice)       AS cnpj_label,
  l.documento                                       AS cnpj_documento,
  SUM(s.valor_autorizado)                           AS total_autorizado,
  SUM(s.valor_cancelado)                            AS total_cancelado,
  SUM(s.valor_a_apurar)                             AS total_a_apurar,
  SUM(s.vrst_autorizado)                            AS total_st_autorizado,
  SUM(COALESCE(s.qtd_autorizada, 0))                AS qtd_notas,
  SUM(COALESCE(s.qtd_cancelada, 0))                 AS qtd_canceladas,
  -- novas (split por tipo)
  COALESCE(SUM(s.valor_autorizado) FILTER (WHERE s.nf_tipo = 'NFCe'), 0) AS total_nfce,
  COALESCE(SUM(s.valor_autorizado) FILTER (WHERE s.nf_tipo = 'NFe'), 0)  AS total_nfe,
  COALESCE(SUM(s.qtd_autorizada)   FILTER (WHERE s.nf_tipo = 'NFCe'), 0) AS qtd_nfce,
  COALESCE(SUM(s.qtd_autorizada)   FILTER (WHERE s.nf_tipo = 'NFe'), 0)  AS qtd_nfe
FROM silver.contahub_notas_fiscais s
LEFT JOIN financial.nf_cnpj_labels l
  ON l.bar_id = s.bar_id AND l.cnpj_indice = s.cnpj_indice
GROUP BY s.bar_id, s.nf_dtcontabil, s.cnpj_indice, l.label, l.documento;
