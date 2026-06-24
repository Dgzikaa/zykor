-- Aba única "Conferência" (junta NF×Stone e ContaHub×NF). Dia-level traz a dupla
-- conferência (Stone×ContaHub-cartão e NF×ContaHub-total) + Stone; per-CNPJ traz NF×Stone.
-- Tudo na base GERENCIAL. ContaHub NÃO separa por CNPJ (só dia).
ALTER TABLE gold.conciliacao_contahub_nf_diaria
  ADD COLUMN IF NOT EXISTS contahub_cartao numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stone_bruto     numeric(14,2) DEFAULT 0;

-- gold.fn_refresh_conciliacao_fiscal (corpo completo aplicado em prod):
--  Item 2 (per CNPJ): NF = silver.contahub_notas_fiscais por (vd_dtgerencial, cnpj_indice)
--    + financial.nf_cnpj_labels p/ rótulo; Stone = silver.stone_transacoes.dt_gerencial por CNPJ.
--  Item 3 (dia): contahub_total + contahub_qtd de bronze pagamentos (dt_gerencial);
--    nf_autorizado de silver NF (vd_dtgerencial); stone_bruto + contahub_cartao REUSADOS de
--    gold.stone_conciliacao_diaria (aba 1) p/ a checagem Stone×cartão bater 100% com a aba 1.
-- Backfill 2026 já rodado p/ bares 3 e 4. Cron conciliacao-fiscal-diario mantém fresco.
