-- =============================================================================
-- CMO Fixo da OPERACAO (folha sem pro-labore) na gold mensal — 13/08/2026
-- =============================================================================
--
-- O plano operacional usava uma folha DIGITADA (R$ 172.000) como CMO Fixo. O Cadu:
--
--   "a folha mensal altera bastante. o ideal era conseguir puxar de algum relatorio
--    financeiro [...] so que isso aqui n inclui alimentacao, nem bonus por meta.
--    por isso q o mes sempre fica errado"
--
-- O financeiro ja tem tudo. Em silver.lancamento_classificado, bloco 'Mao-de-Obra':
--
--   SALARIO FUNCIONARIOS · PROVISAO TRABALHISTA · VALE TRANSPORTE
--   ALIMENTACAO · ADICIONAIS          <- justamente os dois que faltavam no relatorio dele
--   FREELA *                          <- variavel, ja e o que o plano projeta
--   PRO LABORE                        <- socios, NAO e custo da operacao
--
-- POR QUE TIRAR O PRO LABORE — e a descoberta que fecha um numero magico antigo:
-- ele e R$ 64.000 cravado TODO mes no bar 3. E a planilha calculava
--   CMO Fixo mensal = SUM(4 semanas) - 64000
-- Eu tinha registrado esse "-64.000" como ajuste manual sem regra nenhuma. Nao e:
-- e o pro-labore saindo do CMO. A planilha estava certa, faltava o nome.
--
-- A folha real da operacao no bar 3 em 2026 (sem pro-labore, com alimentacao e adicionais):
--   jan 170.721 · fev 174.680 · mar 174.787 · abr 180.855 · mai 181.993 · jun 199.939 · jul 198.990
-- O 172.000 digitado era JANEIRO. De la pra ca subiu 16% — e por isso que "o mes sempre
-- fica errado".
--
-- Colunas novas no FIM da lista de proposito: create or replace view so aceita adicao no fim.
-- =============================================================================

CREATE OR REPLACE VIEW gold.cmo_produtividade_mensal AS
WITH mo AS (
  SELECT bar_id, date_trunc('month', data_competencia)::date AS mes,
    SUM(valor_bruto) AS cmo_total,
    SUM(valor_bruto) FILTER (WHERE categoria_zykor ILIKE 'FREELA%') AS cmo_variavel,
    SUM(valor_bruto) FILTER (WHERE categoria_zykor NOT ILIKE 'FREELA%') AS cmo_fixo,
    -- folha da OPERACAO: fixo sem os socios
    SUM(valor_bruto) FILTER (
      WHERE categoria_zykor NOT ILIKE 'FREELA%' AND categoria_zykor <> 'PRO LABORE'
    ) AS cmo_fixo_operacao,
    SUM(valor_bruto) FILTER (WHERE categoria_zykor = 'PRO LABORE') AS pro_labore
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
  CASE WHEN fat.pessoas>0 THEN ROUND(mo.cmo_total/fat.pessoas,2) END AS cmo_por_cliente,
  ROUND(COALESCE(mo.cmo_fixo_operacao,0),2) AS cmo_fixo_operacao,
  ROUND(COALESCE(mo.pro_labore,0),2) AS pro_labore
FROM mo FULL OUTER JOIN fat ON mo.bar_id=fat.bar_id AND mo.mes=fat.mes
ORDER BY bar_id, mes;

GRANT SELECT ON gold.cmo_produtividade_mensal TO anon, authenticated, service_role;

COMMENT ON VIEW gold.cmo_produtividade_mensal IS
  'CMO mensal vs faturamento. cmo_fixo inclui PRO LABORE (visao contabil); '
  'cmo_fixo_operacao exclui (visao de operacao) — e o que o plano operacional consome como '
  'CMO Fixo, no lugar da folha digitada.';

-- -----------------------------------------------------------------------------
-- O parametro do plano deixa de ter a folha digitada: nulo = puxa do financeiro.
-- O valor antigo (172.000, que era a folha de JANEIRO) fica registrado aqui e no
-- historico de vigencias, nao se perde.
-- -----------------------------------------------------------------------------
UPDATE operations.operacao_parametro
   SET cmo_fixo_mensal = NULL
 WHERE bar_id = 3 AND cmo_fixo_mensal = 172000.00;

COMMENT ON COLUMN operations.operacao_parametro.cmo_fixo_mensal IS
  'OVERRIDE da folha do mes. Nulo (o normal) = vem de gold.cmo_produtividade_mensal '
  '(cmo_fixo_operacao): realizado no mes fechado, media dos 3 ultimos fechados no mes em '
  'curso ou futuro. Preencher aqui e para o caso excepcional em que o financeiro esta errado.';
