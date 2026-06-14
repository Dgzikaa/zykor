-- 2026-06-14 — DRE (financial.dre_excel) passa a incluir os ajustes da aba
-- DRE Manual (financial.dre_manual) e a NETAR receitas dentro de cada categoria
-- pelo tipo do lançamento.
--
-- Antes: valor_com_sinal = SUM(valor_bruto) * sinal_do_mapa. Isso (a) tratava
-- receitas/devoluções lançadas dentro de uma categoria de despesa como MAIS custo
-- (não netava) e (b) ignorava os ajustes manuais. Resultado: DRE divergia da
-- planilha do sócio e da orçamentação.
--
-- Agora: valor_com_sinal por impacto no lucro (RECEITA soma, DESPESA subtrai) +
-- UNION com dre_manual (cujo valor já está em sinal de DRE). Assim a aba DRE =
-- orçamentação (Conta Azul + DRE Manual). Validado em mai/2026 bar 3.
--
-- Já aplicado em produção via MCP apply_migration em 2026-06-14; versionado aqui.

CREATE OR REPLACE VIEW financial.dre_excel AS
WITH base AS (
  SELECT
    l.bar_id,
    date_trunc('month', l.data_competencia::timestamptz)::date AS mes,
    m.categoria_macro,
    m.ordem_macro,
    m.ordem_sub,
    COALESCE(NULLIF(TRIM(BOTH FROM l.categoria_nome), ''), 'Sem categoria') AS categoria,
    SUM(CASE WHEN l.tipo = 'RECEITA' THEN l.valor_bruto ELSE -l.valor_bruto END) AS valor_com_sinal
  FROM bronze.bronze_contaazul_lancamentos l
  LEFT JOIN financial.dre_categoria_macro m
    ON upper(TRIM(BOTH FROM m.categoria_nome)) = upper(TRIM(BOTH FROM l.categoria_nome))
  WHERE l.data_competencia >= date_trunc('year', CURRENT_DATE)
    AND l.data_competencia < (date_trunc('year', CURRENT_DATE) + interval '1 year')
    AND l.excluido_em IS NULL
  GROUP BY 1, 2, 3, 4, 5, 6

  UNION ALL

  SELECT
    dm.bar_id,
    date_trunc('month', dm.data_competencia::timestamptz)::date AS mes,
    dm.categoria_macro,
    mm.ordem_macro,
    mm.ordem_sub,
    COALESCE(NULLIF(TRIM(BOTH FROM dm.categoria), ''), 'Sem categoria') AS categoria,
    SUM(dm.valor) AS valor_com_sinal
  FROM financial.dre_manual dm
  LEFT JOIN financial.dre_categoria_macro mm
    ON upper(TRIM(BOTH FROM mm.categoria_nome)) = upper(TRIM(BOTH FROM dm.categoria))
  WHERE dm.data_competencia >= date_trunc('year', CURRENT_DATE)
    AND dm.data_competencia < (date_trunc('year', CURRENT_DATE) + interval '1 year')
  GROUP BY 1, 2, 3, 4, 5, 6
),
agg AS (
  SELECT
    bar_id, mes,
    COALESCE(categoria_macro, 'Não Mapeado') AS categoria_macro,
    categoria,
    MAX(ordem_macro) AS ordem_macro,
    MAX(ordem_sub) AS ordem_sub,
    SUM(valor_com_sinal) AS valor_com_sinal
  FROM base
  GROUP BY bar_id, mes, COALESCE(categoria_macro, 'Não Mapeado'), categoria
),
receita_mes AS (
  SELECT bar_id, mes, SUM(valor_com_sinal) AS receita_total
  FROM agg WHERE categoria_macro = 'Receita'
  GROUP BY bar_id, mes
)
SELECT
  a.bar_id,
  a.mes,
  a.categoria_macro,
  COALESCE(a.ordem_macro, 99)::integer AS ordem_macro,
  COALESCE(a.ordem_sub, 99)::integer AS ordem_sub,
  a.categoria,
  (CASE WHEN a.valor_com_sinal < 0 THEN -1 ELSE 1 END)::smallint AS sinal,
  a.valor_com_sinal::numeric(14,2) AS valor_com_sinal,
  CASE WHEN r.receita_total > 0 THEN round(a.valor_com_sinal / r.receita_total * 100, 1) ELSE NULL END AS percentual_receita
FROM agg a
LEFT JOIN receita_mes r ON r.bar_id = a.bar_id AND r.mes = a.mes;
