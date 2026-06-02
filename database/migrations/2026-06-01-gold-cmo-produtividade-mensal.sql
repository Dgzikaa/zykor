-- Nova gold: CMO (mão de obra) por mês vs faturamento operacional. Grão MENSAL
-- (lançamentos de MO usam competência mensal). Fixo = salário/encargos; Variável =
-- FREELA*. Faturamento de silver.vendas_diarias. Aplicada via MCP 2026-06-01.
CREATE OR REPLACE VIEW gold.cmo_produtividade_mensal AS
WITH mo AS (
  SELECT bar_id, date_trunc('month', data_competencia)::date AS mes,
    SUM(valor_bruto) AS cmo_total,
    SUM(valor_bruto) FILTER (WHERE categoria_zykor ILIKE 'FREELA%') AS cmo_variavel,
    SUM(valor_bruto) FILTER (WHERE categoria_zykor NOT ILIKE 'FREELA%') AS cmo_fixo
  FROM silver.lancamento_classificado
  WHERE is_ignorado = false AND bloco_dre = 'Mão-de-Obra' AND data_competencia IS NOT NULL
  GROUP BY 1, 2
),
fat AS (
  SELECT bar_id, date_trunc('month', dt_gerencial)::date AS mes,
    SUM(faturamento_liquido_r) AS faturamento_liquido, SUM(total_pessoas) AS pessoas
  FROM silver.vendas_diarias GROUP BY 1, 2
)
SELECT COALESCE(mo.bar_id, fat.bar_id) AS bar_id, COALESCE(mo.mes, fat.mes) AS mes,
  ROUND(COALESCE(mo.cmo_total,0),2) AS cmo_total, ROUND(COALESCE(mo.cmo_fixo,0),2) AS cmo_fixo,
  ROUND(COALESCE(mo.cmo_variavel,0),2) AS cmo_variavel,
  ROUND(COALESCE(fat.faturamento_liquido,0),2) AS faturamento_liquido, COALESCE(fat.pessoas,0) AS pessoas,
  CASE WHEN fat.faturamento_liquido>0 THEN ROUND((mo.cmo_total/fat.faturamento_liquido)*100,2) END AS cmo_pct,
  CASE WHEN fat.pessoas>0 THEN ROUND(mo.cmo_total/fat.pessoas,2) END AS cmo_por_cliente
FROM mo FULL OUTER JOIN fat ON mo.bar_id=fat.bar_id AND mo.mes=fat.mes
ORDER BY bar_id, mes;
GRANT SELECT ON gold.cmo_produtividade_mensal TO anon, authenticated, service_role;
