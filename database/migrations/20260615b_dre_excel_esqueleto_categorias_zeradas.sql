-- 2026-06-15 — DRE exibe a ESTRUTURA pronta (categorias zeradas).
--
-- A DRE so renderiza categoria que aparece na view financial.dre_excel, e a view
-- so emitia categoria com lançamento. Resultado: categoria nova ([Consumação] ...)
-- nao aparecia ate ter o 1o lançamento. Pedido do socio: ver a estrutura pronta.
--
-- Solucao: 3a branch no CTE base ("esqueleto") que emite TODA categoria do de-para
-- zerada no mes corrente, por bar ativo. Categoria com lançamento soma normal
-- (esqueleto entra como 0, nao altera nada). Mantem o canon (nome canonico por
-- macro/ordem_sub) pra nao duplicar linha.
--
-- Ver corpo aplicado em apply_migration dre_excel_esqueleto_categorias_zeradas.
-- (View completa versionada aqui pra historico.)

CREATE OR REPLACE VIEW financial.dre_excel AS
WITH canon AS (
  SELECT categoria_macro, ordem_sub, min(categoria_nome) AS categoria_canon
  FROM financial.dre_categoria_macro
  GROUP BY categoria_macro, ordem_sub
),
base AS (
  SELECT l.bar_id,
    date_trunc('month', l.data_competencia::timestamptz)::date AS mes,
    m.categoria_macro, m.ordem_macro, m.ordem_sub,
    COALESCE(c.categoria_canon, NULLIF(TRIM(l.categoria_nome), ''), 'Sem categoria') AS categoria,
    sum(CASE WHEN l.tipo = 'RECEITA' THEN l.valor_bruto ELSE -l.valor_bruto END) AS valor_com_sinal
  FROM bronze.bronze_contaazul_lancamentos l
  LEFT JOIN financial.dre_categoria_macro m ON upper(TRIM(m.categoria_nome)) = upper(TRIM(l.categoria_nome))
  LEFT JOIN canon c ON c.categoria_macro = m.categoria_macro AND c.ordem_sub = m.ordem_sub
  WHERE l.data_competencia >= date_trunc('year', CURRENT_DATE)
    AND l.data_competencia < date_trunc('year', CURRENT_DATE) + interval '1 year'
    AND l.excluido_em IS NULL
  GROUP BY l.bar_id, date_trunc('month', l.data_competencia::timestamptz)::date,
    m.categoria_macro, m.ordem_macro, m.ordem_sub,
    COALESCE(c.categoria_canon, NULLIF(TRIM(l.categoria_nome), ''), 'Sem categoria')
  UNION ALL
  SELECT dm.bar_id,
    date_trunc('month', dm.data_competencia::timestamptz)::date AS mes,
    dm.categoria_macro, mm.ordem_macro, mm.ordem_sub,
    COALESCE(c.categoria_canon, NULLIF(TRIM(dm.categoria), ''), 'Sem categoria') AS categoria,
    sum(dm.valor) AS valor_com_sinal
  FROM financial.dre_manual dm
  LEFT JOIN financial.dre_categoria_macro mm ON upper(TRIM(mm.categoria_nome)) = upper(TRIM(dm.categoria))
  LEFT JOIN canon c ON c.categoria_macro = mm.categoria_macro AND c.ordem_sub = mm.ordem_sub
  WHERE dm.data_competencia >= date_trunc('year', CURRENT_DATE)
    AND dm.data_competencia < date_trunc('year', CURRENT_DATE) + interval '1 year'
  GROUP BY dm.bar_id, date_trunc('month', dm.data_competencia::timestamptz)::date,
    dm.categoria_macro, mm.ordem_macro, mm.ordem_sub,
    COALESCE(c.categoria_canon, NULLIF(TRIM(dm.categoria), ''), 'Sem categoria')
  UNION ALL
  -- ESQUELETO
  SELECT b.bar_id,
    date_trunc('month', CURRENT_DATE)::date AS mes,
    z.categoria_macro, z.ordem_macro, z.ordem_sub, z.categoria_canon AS categoria,
    0::numeric AS valor_com_sinal
  FROM (
    SELECT DISTINCT bar_id FROM bronze.bronze_contaazul_lancamentos
    WHERE data_competencia >= date_trunc('year', CURRENT_DATE) AND excluido_em IS NULL
  ) b
  CROSS JOIN (
    SELECT categoria_macro, max(ordem_macro) AS ordem_macro, ordem_sub, min(categoria_nome) AS categoria_canon
    FROM financial.dre_categoria_macro
    GROUP BY categoria_macro, ordem_sub
  ) z
),
agg AS (
  SELECT base.bar_id, base.mes,
    COALESCE(base.categoria_macro, 'Não Mapeado') AS categoria_macro,
    base.categoria,
    max(base.ordem_macro) AS ordem_macro,
    max(base.ordem_sub) AS ordem_sub,
    sum(base.valor_com_sinal) AS valor_com_sinal
  FROM base
  GROUP BY base.bar_id, base.mes, COALESCE(base.categoria_macro, 'Não Mapeado'), base.categoria
),
receita_mes AS (
  SELECT bar_id, mes, sum(valor_com_sinal) AS receita_total
  FROM agg WHERE categoria_macro = 'Receita'
  GROUP BY bar_id, mes
)
SELECT a.bar_id, a.mes, a.categoria_macro,
  COALESCE(a.ordem_macro::integer, 99) AS ordem_macro,
  COALESCE(a.ordem_sub::integer, 99) AS ordem_sub,
  a.categoria,
  CASE WHEN a.valor_com_sinal < 0::numeric THEN -1 ELSE 1 END::smallint AS sinal,
  a.valor_com_sinal::numeric(14,2) AS valor_com_sinal,
  CASE WHEN r.receita_total > 0::numeric THEN round(a.valor_com_sinal / r.receita_total * 100::numeric, 1) ELSE NULL::numeric END AS percentual_receita
FROM agg a
LEFT JOIN receita_mes r ON r.bar_id = a.bar_id AND r.mes = a.mes;
