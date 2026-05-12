-- Backfill stockout: gold base (legada, 27/11/2025 a 30/03/2026) -> bronze -> silver
-- Motivacao: medallion (bronze/silver) so foi populado a partir de 31/03/2026.
-- A gold base tem 124 dias de historico nao acessivel pelas paginas (view
-- gold_filtrado le de silver). Reconstituimos bronze e silver preservando
-- a gold base intocada (auditoria de referencia).
-- Regras silver replicadas de backend/supabase/functions/stockout-processar/index.ts v2.0

-- 1. Bronze: reconstituir raw_data a partir da gold base
INSERT INTO bronze.bronze_contahub_operacional_stockout_raw (
  bar_id, data_consulta, hora_consulta_real,
  emp, prd, loc, prd_desc, prd_venda, prd_ativo, prd_produzido, prd_unid,
  prd_precovenda, prd_estoque, prd_controlaestoque, prd_validaestoquevenda,
  prd_opcoes, prd_venda7, prd_venda30, prd_venda180,
  loc_desc, loc_inativo, loc_statusimpressao,
  raw_data
)
SELECT
  g.bar_id,
  g.data_consulta,
  COALESCE(g.hora_consulta, (g.data_consulta + INTERVAL '19 hours') AT TIME ZONE 'America/Sao_Paulo'),
  g.emp,
  g.prd,
  g.loc,
  g.prd_desc,
  g.prd_venda,
  g.prd_ativo,
  g.prd_produzido,
  g.prd_unid,
  g.prd_precovenda,
  g.prd_estoque,
  g.prd_controlaestoque,
  g.prd_validaestoquevenda,
  g.prd_opcoes,
  g.prd_venda7,
  g.prd_venda30,
  g.prd_venda180,
  g.loc_desc,
  g.loc_inativo,
  g.loc_statusimpressao,
  COALESCE(g.raw_data, '{}'::jsonb) || jsonb_build_object('grp_desc', g.grp_desc)
FROM gold.gold_contahub_operacional_stockout g
WHERE g.data_consulta < '2026-03-31'
  AND NOT EXISTS (
    SELECT 1 FROM bronze.bronze_contahub_operacional_stockout_raw b
    WHERE b.bar_id = g.bar_id
      AND b.data_consulta = g.data_consulta
      AND b.prd = g.prd
      AND COALESCE(b.loc, '') = COALESCE(g.loc, '')
  );

-- 2. Silver: aplicar regras v2.0 sobre o bronze pre-medallion
INSERT INTO silver.silver_contahub_operacional_stockout_processado (
  raw_id, bar_id, data_consulta, hora_coleta,
  prd, prd_desc, prd_venda, prd_ativo, prd_precovenda, prd_estoque, loc_desc,
  categoria_mix, categoria_local,
  incluido, motivo_exclusao, regra_aplicada, ordem_aplicacao,
  versao_regras
)
WITH dedup AS (
  SELECT DISTINCT ON (bar_id, data_consulta, prd, loc)
    id, bar_id, data_consulta, hora_consulta_real,
    prd, prd_desc, prd_venda, prd_ativo, prd_precovenda, prd_estoque,
    loc_desc, raw_data
  FROM bronze.bronze_contahub_operacional_stockout_raw
  WHERE data_consulta < '2026-03-31'
  ORDER BY bar_id, data_consulta, prd, loc, hora_consulta_real DESC
),
classificado AS (
  SELECT
    d.id, d.bar_id, d.data_consulta, d.hora_consulta_real,
    d.prd, d.prd_desc, d.prd_venda, d.prd_ativo, d.prd_precovenda, d.prd_estoque, d.loc_desc,
    -- categoria_mix
    CASE
      WHEN d.bar_id = 3 THEN
        CASE
          WHEN lower(d.loc_desc) LIKE '%batidos%' OR lower(d.loc_desc) LIKE '%montados%' OR lower(d.loc_desc) LIKE '%mexido%' OR lower(d.loc_desc) LIKE '%preshh%' OR lower(d.loc_desc) LIKE '%pp drinks%' THEN 'DRINK'
          WHEN lower(d.loc_desc) LIKE '%shot%' OR lower(d.loc_desc) LIKE '%dose%' OR lower(d.loc_desc) LIKE '%chopp%' OR lower(d.loc_desc) LIKE '%pp bebidas%' OR lower(d.loc_desc) LIKE '%bar%' THEN 'BEBIDA'
          WHEN lower(d.loc_desc) LIKE '%cozinha%' THEN 'COMIDA'
          ELSE 'OUTRO'
        END
      WHEN d.bar_id = 4 THEN
        CASE
          WHEN lower(d.loc_desc) = 'salao' THEN 'BEBIDA'
          WHEN lower(d.loc_desc) = 'bar' THEN 'DRINK'
          WHEN lower(d.loc_desc) LIKE '%cozinha%' THEN 'COMIDA'
          ELSE 'OUTRO'
        END
      ELSE 'OUTRO'
    END AS categoria_mix,
    -- incluido + motivo + regra + ordem (primeira regra que bate)
    CASE
      WHEN d.prd_ativo IS DISTINCT FROM 'S' THEN 'produto_inativo|prd_ativo_check|1'
      WHEN d.loc_desc IS NULL THEN 'loc_desc_null|loc_desc_check|2'
      WHEN d.prd_desc LIKE '[HH]%' THEN 'prefixo_hh|rule_prefixo_hh|3'
      WHEN d.prd_desc LIKE '[DD]%' THEN 'prefixo_dd|rule_prefixo_dd|4'
      WHEN d.prd_desc LIKE '[IN]%' THEN 'prefixo_in|rule_prefixo_in|5'
      WHEN d.prd_desc LIKE '[PP]%' THEN 'prefixo_pp|rule_prefixo_pp|6'
      WHEN lower(d.loc_desc) = 'pegue e pague' THEN 'loc_pegue_pague|rule_loc_pegue_pague|7'
      WHEN lower(d.loc_desc) = 'venda volante' THEN 'loc_venda_volante|rule_loc_venda_volante|8'
      WHEN lower(d.loc_desc) = 'baldes' THEN 'loc_baldes|rule_loc_baldes|9'
      WHEN lower(d.raw_data->>'grp_desc') = 'baldes' THEN 'grp_baldes|rule_grp_baldes|10'
      WHEN lower(d.raw_data->>'grp_desc') = 'happy hour' THEN 'grp_happy_hour|rule_grp_happy_hour|11'
      WHEN lower(d.raw_data->>'grp_desc') = 'chegadeira' THEN 'grp_chegadeira|rule_grp_chegadeira|12'
      WHEN lower(d.raw_data->>'grp_desc') IN ('dose dupla','dose dupla!') THEN 'grp_dose_dupla|rule_grp_dose_dupla|13'
      WHEN lower(d.raw_data->>'grp_desc') = 'dose dupla sem alcool' OR lower(d.raw_data->>'grp_desc') = 'dose dupla sem álcool' THEN 'grp_dose_dupla_sem_alcool|rule_grp_dose_dupla_sem_alcool|14'
      WHEN lower(d.raw_data->>'grp_desc') = 'grupo adicional' THEN 'grp_adicional|rule_grp_adicional|15'
      WHEN lower(d.raw_data->>'grp_desc') = 'insumos' THEN 'grp_insumos|rule_grp_insumos|16'
      WHEN lower(d.raw_data->>'grp_desc') = 'promo chivas' THEN 'grp_promo_chivas|rule_grp_promo_chivas|17'
      WHEN lower(d.raw_data->>'grp_desc') = 'uso interno' THEN 'grp_uso_interno|rule_grp_uso_interno|18'
      WHEN lower(d.raw_data->>'grp_desc') = 'pegue e pague' THEN 'grp_pegue_pague|rule_grp_pegue_pague|19'
      WHEN lower(d.prd_desc) LIKE '%happy hour%' OR lower(d.prd_desc) LIKE '%happyhour%' OR lower(d.prd_desc) LIKE '%happy-hour%' THEN 'palavra_happy_hour|rule_palavra_happy_hour|20'
      WHEN lower(d.prd_desc) LIKE '% hh%' THEN 'palavra_hh|rule_palavra_hh|21'
      WHEN lower(d.prd_desc) LIKE '%dose dupla%' OR lower(d.prd_desc) LIKE '%dose dulpa%' THEN 'palavra_dose_dupla|rule_palavra_dose_dupla|22'
      WHEN lower(d.prd_desc) LIKE '%balde%' THEN 'palavra_balde|rule_palavra_balde|23'
      WHEN lower(d.prd_desc) LIKE '%garrafa%' THEN 'palavra_garrafa|rule_palavra_garrafa|24'
      WHEN lower(d.prd_desc) LIKE '%combo %' THEN 'palavra_combo|rule_palavra_combo|25'
      WHEN lower(d.prd_desc) LIKE '%adicional%' THEN 'palavra_adicional|rule_palavra_adicional|26'
      WHEN lower(d.prd_desc) LIKE '%embalagem%' THEN 'palavra_embalagem|rule_palavra_embalagem|27'
      ELSE 'OK||'
    END AS regra_str
  FROM dedup d
)
SELECT
  c.id, c.bar_id, c.data_consulta, c.hora_consulta_real,
  c.prd, c.prd_desc, c.prd_venda, c.prd_ativo, c.prd_precovenda, c.prd_estoque, c.loc_desc,
  c.categoria_mix,
  CASE c.categoria_mix
    WHEN 'BEBIDA' THEN 'Bar'
    WHEN 'DRINK' THEN 'Drinks'
    WHEN 'COMIDA' THEN 'Comidas'
    ELSE 'Outro'
  END AS categoria_local,
  (split_part(c.regra_str, '|', 1) = 'OK') AS incluido,
  NULLIF(split_part(c.regra_str, '|', 1), 'OK') AS motivo_exclusao,
  NULLIF(split_part(c.regra_str, '|', 2), '') AS regra_aplicada,
  NULLIF(split_part(c.regra_str, '|', 3), '')::int AS ordem_aplicacao,
  '2.0' AS versao_regras
FROM classificado c
WHERE NOT EXISTS (
  SELECT 1 FROM silver.silver_contahub_operacional_stockout_processado s
  WHERE s.bar_id = c.bar_id AND s.data_consulta = c.data_consulta
    AND s.prd = c.prd AND COALESCE(s.loc_desc,'') = COALESCE(c.loc_desc,'')
);
