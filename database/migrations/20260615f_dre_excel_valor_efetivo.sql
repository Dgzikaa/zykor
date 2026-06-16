-- 2026-06-15 — DRE usa valor EFETIVO (pago>0 ? pago : bruto) em vez de valor_bruto.
--
-- Motivo: divergências de centavos vs Conta Azul (ex: Custo Bebidas mai −189.464,88
-- na Zykor vs −189.463,33 no CA = 1,55 de juros/arredondamento na liquidação). O CA
-- mostra o valor liquidado (pago); a DRE somava o bruto. Agora bate na vírgula.
-- Itens ainda não pagos (a pagar) caem no bruto (valor_pago=0). Mesma regra do CMV.
--
-- (Corpo da view aplicado em apply_migration dre_excel_valor_efetivo — a mudança é
--  só a expressão de soma: COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto).)
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
    sum(CASE WHEN l.tipo = 'RECEITA'
             THEN COALESCE(NULLIF(l.valor_pago, 0), l.valor_bruto)
             ELSE -COALESCE(NULLIF(l.valor_pago, 0), l.valor_bruto) END) AS valor_com_sinal
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
  SELECT b.bar_id, date_trunc('month', CURRENT_DATE)::date AS mes,
    z.categoria_macro, z.ordem_macro, z.ordem_sub, z.categoria_canon AS categoria, 0::numeric
  FROM (SELECT DISTINCT bar_id FROM bronze.bronze_contaazul_lancamentos
        WHERE data_competencia >= date_trunc('year', CURRENT_DATE) AND excluido_em IS NULL) b
  CROSS JOIN (SELECT categoria_macro, max(ordem_macro) AS ordem_macro, ordem_sub, min(categoria_nome) AS categoria_canon
              FROM financial.dre_categoria_macro GROUP BY categoria_macro, ordem_sub) z
),
agg AS (
  SELECT base.bar_id, base.mes, COALESCE(base.categoria_macro, 'Não Mapeado') AS categoria_macro,
    base.categoria, max(base.ordem_macro) AS ordem_macro, max(base.ordem_sub) AS ordem_sub,
    sum(base.valor_com_sinal) AS valor_com_sinal
  FROM base
  GROUP BY base.bar_id, base.mes, COALESCE(base.categoria_macro, 'Não Mapeado'), base.categoria
),
receita_mes AS (
  SELECT bar_id, mes, sum(valor_com_sinal) AS receita_total FROM agg WHERE categoria_macro = 'Receita' GROUP BY bar_id, mes
)
SELECT a.bar_id, a.mes, a.categoria_macro,
  COALESCE(a.ordem_macro::integer, 99) AS ordem_macro, COALESCE(a.ordem_sub::integer, 99) AS ordem_sub,
  a.categoria, CASE WHEN a.valor_com_sinal < 0::numeric THEN -1 ELSE 1 END::smallint AS sinal,
  a.valor_com_sinal::numeric(14,2) AS valor_com_sinal,
  CASE WHEN r.receita_total > 0::numeric THEN round(a.valor_com_sinal / r.receita_total * 100::numeric, 1) ELSE NULL::numeric END AS percentual_receita
FROM agg a
LEFT JOIN receita_mes r ON r.bar_id = a.bar_id AND r.mes = a.mes;
