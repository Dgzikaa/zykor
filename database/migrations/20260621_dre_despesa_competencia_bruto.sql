-- 2026-06-21 — DRE 100% em regime de COMPETÊNCIA (valor bruto), receita e despesa.
-- Bug original: get_dre_por_ano usava COALESCE(NULLIF(valor_pago,0), valor_bruto) (paga-primeiro).
-- Quando uma parcela está PARTIAL (pago < bruto), pegava o pago parcial → subreportava.
-- Caso real: IMPOSTO maio 75.504 vs CA 83.209,70 (parcela Simples Nacional bruto 12.771,60 / pago 5.066,01).
-- Decisão do sócio (2026-06-21): "deixar sempre o total bruto da competência" — receita E despesa.
-- Receita: faturado vs recebido era ~R$0 de diferença (já lançada cheia), então sem impacto material.
-- Fix: valor = sinal × COALESCE(NULLIF(valor_bruto,0), valor_pago) — bruto sempre; cai pro pago só se bruto=0.
-- Bronze estava correto/fresco; o bug era 100% na função (não era sync nem botão). Live (função de banco).
CREATE OR REPLACE FUNCTION public.get_dre_por_ano(p_bar_id integer, p_ano integer)
 RETURNS TABLE(bar_id integer, mes date, categoria_macro text, ordem_macro integer, ordem_sub integer, categoria text, sinal smallint, valor_com_sinal numeric, percentual_receita numeric)
 LANGUAGE sql STABLE SET search_path TO 'public', 'financial', 'bronze', 'pg_catalog'
AS $function$
  WITH canon AS (
    SELECT categoria_macro, ordem_sub, min(categoria_nome) AS categoria_canon
    FROM financial.dre_categoria_macro GROUP BY categoria_macro, ordem_sub
  ),
  base AS (
    SELECT l.bar_id,
      date_trunc('month', l.data_competencia::timestamptz)::date AS mes,
      m.categoria_macro, m.ordem_macro, m.ordem_sub,
      COALESCE(c.categoria_canon, NULLIF(TRIM(l.categoria_nome), ''), 'Sem categoria') AS categoria,
      sum((CASE WHEN l.tipo = 'RECEITA' THEN 1 ELSE -1 END) * COALESCE(NULLIF(l.valor_bruto,0), l.valor_pago)) AS valor_com_sinal
    FROM bronze.bronze_contaazul_lancamentos l
    LEFT JOIN financial.dre_categoria_macro m ON upper(TRIM(m.categoria_nome)) = upper(TRIM(l.categoria_nome))
    LEFT JOIN canon c ON c.categoria_macro = m.categoria_macro AND c.ordem_sub = m.ordem_sub
    WHERE l.bar_id = p_bar_id
      AND l.data_competencia >= make_date(p_ano,1,1)
      AND l.data_competencia < make_date(p_ano+1,1,1)
      AND l.excluido_em IS NULL
    GROUP BY l.bar_id, date_trunc('month', l.data_competencia::timestamptz)::date,
      m.categoria_macro, m.ordem_macro, m.ordem_sub,
      COALESCE(c.categoria_canon, NULLIF(TRIM(l.categoria_nome), ''), 'Sem categoria')
    UNION ALL
    SELECT p_bar_id, make_date(p_ano,1,1), z.categoria_macro, z.ordem_macro, z.ordem_sub, z.categoria_canon, 0::numeric
    FROM (
      SELECT categoria_macro, max(ordem_macro) AS ordem_macro, ordem_sub, min(categoria_nome) AS categoria_canon
      FROM financial.dre_categoria_macro
      WHERE categoria_nome NOT LIKE 'Marketing%'
      GROUP BY categoria_macro, ordem_sub
    ) z
  ),
  agg AS (
    SELECT base.bar_id, base.mes, COALESCE(base.categoria_macro,'Não Mapeado') AS categoria_macro,
      base.categoria, max(base.ordem_macro) AS ordem_macro, max(base.ordem_sub) AS ordem_sub,
      sum(base.valor_com_sinal) AS valor_com_sinal
    FROM base GROUP BY base.bar_id, base.mes, COALESCE(base.categoria_macro,'Não Mapeado'), base.categoria
  ),
  receita_mes AS (
    SELECT a.bar_id, a.mes, sum(a.valor_com_sinal) AS receita_total FROM agg a WHERE a.categoria_macro='Receita' GROUP BY a.bar_id, a.mes
  )
  SELECT a.bar_id, a.mes, a.categoria_macro,
    COALESCE(a.ordem_macro::integer,99), COALESCE(a.ordem_sub::integer,99), a.categoria,
    (CASE WHEN a.valor_com_sinal < 0 THEN -1 ELSE 1 END)::smallint,
    a.valor_com_sinal::numeric(14,2),
    CASE WHEN r.receita_total > 0 THEN round(a.valor_com_sinal / r.receita_total * 100, 1) ELSE NULL END
  FROM agg a LEFT JOIN receita_mes r ON r.bar_id=a.bar_id AND r.mes=a.mes;
$function$;
