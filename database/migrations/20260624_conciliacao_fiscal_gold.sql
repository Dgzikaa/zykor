-- Conciliação fiscal (medallion: gold). Abas "NF × Stone (CNPJ)" e "ContaHub × NF"
-- em /financeiro/conciliacao. Dia operacional: NF=data contábil, Stone=corte 6h
-- (bate com gold.stone_conciliacao_diaria), ContaHub=dt_gerencial.

CREATE TABLE IF NOT EXISTS financial.stone_cnpj_map (
  bar_id integer NOT NULL, stone_code text NOT NULL, empresa_nome text,
  cnpj_indice integer, cnpj_documento text, cnpj_label text,
  PRIMARY KEY (bar_id, stone_code)
);
INSERT INTO financial.stone_cnpj_map (bar_id, stone_code, empresa_nome, cnpj_indice, cnpj_documento, cnpj_label) VALUES
  (3, '142630205', 'Ordinário Bar',      1, '57.960.083/0001-88', 'ORDINARIO BAR E GASTRONOMIA LTDA'),
  (3, '149840567', 'Ordibar',            2, '59.085.920/0001-00', 'ORDI BAR LTDA'),
  (4, '144417776', 'Deboche (Descubra)', 1, '40.433.371/0001-81', 'DESCUBRA BAR E RESTAURANTE LTDA'),
  (4, '115466500', 'DSCBR',              3, '54.340.684/0001-08', 'DSCBR BAR E RESTAURANTE LTDA')
ON CONFLICT (bar_id, stone_code) DO NOTHING;
GRANT SELECT ON financial.stone_cnpj_map TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS gold.conciliacao_nf_stone_cnpj_diaria (
  bar_id integer NOT NULL, data date NOT NULL, cnpj_indice integer NOT NULL,
  cnpj_documento text, cnpj_label text,
  nf_autorizado numeric(14,2) DEFAULT 0, nf_qtd bigint DEFAULT 0, nf_cancelado numeric(14,2) DEFAULT 0,
  stone_bruto numeric(14,2) DEFAULT 0, stone_qtd bigint DEFAULT 0, diferenca numeric(14,2) DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(), PRIMARY KEY (bar_id, data, cnpj_indice)
);
GRANT SELECT ON gold.conciliacao_nf_stone_cnpj_diaria TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS gold.conciliacao_contahub_nf_diaria (
  bar_id integer NOT NULL, data date NOT NULL,
  contahub_total numeric(14,2) DEFAULT 0, contahub_qtd bigint DEFAULT 0,
  nf_autorizado numeric(14,2) DEFAULT 0, nf_qtd bigint DEFAULT 0, diferenca numeric(14,2) DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(), PRIMARY KEY (bar_id, data)
);
GRANT SELECT ON gold.conciliacao_contahub_nf_diaria TO anon, authenticated, service_role;

-- ETL (ver corpo aplicado em prod). Reprocessa os dois golds p/ bar/período:
--   NF = gold.notas_fiscais_diaria; Stone = silver.stone_transacoes (corte 6h) via
--   financial.stone_cnpj_map; ContaHub = bronze_contahub_financeiro_pagamentosrecebidos.
-- gold.fn_refresh_conciliacao_fiscal(p_bar_id integer, p_de date, p_ate date) RETURNS jsonb
-- Cron diário: public.cron_refresh_conciliacao_fiscal() (ver 20260624_conciliacao_fiscal_cron.sql).
