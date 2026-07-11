-- Taxa de cartão (custo de maquininha): agrega silver.stone_transacoes (fee_amount por transação)
-- por bandeira (brand_id), tipo (à vista/parcelado) e dia. Taxa efetiva = fee/gross.
-- IMPORTANTE: o campo `taxa` do ContaHub (silver.faturamento_pagamentos) está ZERADO; a fonte
-- real da taxa de cartão é o Stone. Consumido por /api/ferramentas/insights/taxas-cartao (aba
-- "Taxas cartão" em /ferramentas/insights). rpc via service_role.
CREATE OR REPLACE FUNCTION operations.fn_taxa_cartao(
  p_bar_id int,
  p_di     date,
  p_df     date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO operations, silver, public, pg_catalog
AS $$
  WITH base AS (
    SELECT brand_id, number_of_installments AS parc,
           gross_amount AS bruto, fee_amount AS taxa,
           COALESCE(dt_gerencial, reference_date) AS dia
    FROM silver.stone_transacoes
    WHERE bar_id = p_bar_id
      AND COALESCE(dt_gerencial, reference_date) BETWEEN p_di AND p_df
      AND gross_amount > 0 AND fee_amount IS NOT NULL
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
        'taxa_total', round(sum(taxa),0),
        'bruto', round(sum(bruto),0),
        'taxa_pct', round(100.0*sum(taxa)/NULLIF(sum(bruto),0),2),
        'transacoes', count(*)
      ) FROM base),
    'por_bandeira', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.taxa DESC),'[]'::jsonb) FROM (
        SELECT brand_id, count(*) AS transacoes, round(sum(bruto),0) AS bruto,
               round(sum(taxa),0) AS taxa, round(100.0*sum(taxa)/NULLIF(sum(bruto),0),2) AS taxa_pct
        FROM base GROUP BY brand_id) x),
    'por_tipo', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.taxa DESC),'[]'::jsonb) FROM (
        SELECT CASE WHEN parc IS NULL OR parc <= 1 THEN 'À vista' ELSE 'Parcelado' END AS tipo,
               count(*) AS transacoes, round(sum(bruto),0) AS bruto,
               round(sum(taxa),0) AS taxa, round(100.0*sum(taxa)/NULLIF(sum(bruto),0),2) AS taxa_pct
        FROM base GROUP BY 1) x),
    'por_dia', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.dia),'[]'::jsonb) FROM (
        SELECT dia::text AS dia, round(sum(taxa),0) AS taxa,
               round(100.0*sum(taxa)/NULLIF(sum(bruto),0),2) AS taxa_pct
        FROM base GROUP BY dia) x),
    'meta', jsonb_build_object('di',p_di,'df',p_df)
  );
$$;

REVOKE ALL ON FUNCTION operations.fn_taxa_cartao(int,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_taxa_cartao(int,date,date) TO service_role;
