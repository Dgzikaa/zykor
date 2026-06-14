-- 2026-06-14 (b) — Corrige RH duplicado na DRE + canoniza grafias duplicadas.
--
-- Causa raiz: financial.dre_categoria_macro tinha DUAS linhas de RH idênticas sob
-- upper/trim ('Recursos Humanos' e 'RECURSOS HUMANOS'). O JOIN do dre_excel com o
-- bronze é case-insensitive (upper(trim(...))), então cada lançamento de RH casava
-- com as 2 linhas e o valor DOBRAVA (fan-out). Removida a duplicata (mantém
-- 'RECURSOS HUMANOS', canônico igual ao de-para da orçamentação).
--
-- Além disso, a view passa a exibir um nome CANÔNICO por (categoria_macro, ordem_sub)
-- pra unir grafias que diferem só por acento/plural (Custo Comida/Comidas,
-- Utensilios/Utensílios, etc.) numa linha só. Não-mapeadas seguem pelo nome cru.
--
-- Já aplicado em produção via MCP em 2026-06-14; versionado aqui.

DELETE FROM financial.dre_categoria_macro
WHERE categoria_nome = 'Recursos Humanos';

CREATE OR REPLACE VIEW financial.dre_excel AS
WITH canon AS (
  SELECT categoria_macro, ordem_sub, MIN(categoria_nome) AS categoria_canon
  FROM financial.dre_categoria_macro
  GROUP BY categoria_macro, ordem_sub
),
base AS (
  SELECT
    l.bar_id,
    date_trunc('month', l.data_competencia::timestamptz)::date AS mes,
    m.categoria_macro,
    m.ordem_macro,
    m.ordem_sub,
    COALESCE(c.categoria_canon, NULLIF(TRIM(BOTH FROM l.categoria_nome), ''), 'Sem categoria') AS categoria,
    SUM(CASE WHEN l.tipo = 'RECEITA' THEN l.valor_bruto ELSE -l.valor_bruto END) AS valor_com_sinal
  FROM bronze.bronze_contaazul_lancamentos l
  LEFT JOIN financial.dre_categoria_macro m
    ON upper(TRIM(BOTH FROM m.categoria_nome)) = upper(TRIM(BOTH FROM l.categoria_nome))
  LEFT JOIN canon c
    ON c.categoria_macro = m.categoria_macro AND c.ordem_sub = m.ordem_sub
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
    COALESCE(c.categoria_canon, NULLIF(TRIM(BOTH FROM dm.categoria), ''), 'Sem categoria') AS categoria,
    SUM(dm.valor) AS valor_com_sinal
  FROM financial.dre_manual dm
  LEFT JOIN financial.dre_categoria_macro mm
    ON upper(TRIM(BOTH FROM mm.categoria_nome)) = upper(TRIM(BOTH FROM dm.categoria))
  LEFT JOIN canon c
    ON c.categoria_macro = mm.categoria_macro AND c.ordem_sub = mm.ordem_sub
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
