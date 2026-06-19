-- 2026-06-19 — DFC "só conciliado": incluir pagamentos PARCIAIS.
-- Bug: a parcela de pagamento PARCIAL (status='PARTIAL') fica conciliado=false (não foi
-- quitada inteira), mesmo a baixa do valor pago tendo saído e sido conciliada no extrato.
-- O CA conta esse valor no extrato conciliado; o Zykor dropava (filtrava conciliado=true
-- no nível da parcela) -> subreportava despesa -> DFC mais positiva que o CA.
-- Ex.: Maio/2026 "1/10 - Simples Nacional" pago 5.066,01 de 12.771,60 -> IMPOSTO ia 47.146
-- em vez de 52.212 (= a diferença do mês).
-- Fix: no modo só-conciliado, incluir também rows PARTIAL com valor_pago>0 já checadas.
-- O valor já é o correto (COALESCE(NULLIF(valor_pago,0), valor_bruto) = o pago parcial).

CREATE OR REPLACE FUNCTION public.get_dfc_por_ano(p_bar_id integer, p_ano integer, p_so_conciliado boolean DEFAULT false)
 RETURNS TABLE(mes date, grupo_dfc text, categoria text, categoria_macro text, ordem_macro smallint, ordem_sub smallint, entradas numeric, saidas numeric, net numeric)
 LANGUAGE sql STABLE
 SET search_path TO 'public', 'meta', 'financial', 'bronze', 'pg_catalog'
AS $function$
  SELECT
    date_trunc('month', l.data_pagamento)::date AS mes,
    m.grupo_dfc,
    COALESCE(NULLIF(TRIM(l.categoria_nome),''),'(sem categoria)') AS categoria,
    MAX(dm.categoria_macro) AS categoria_macro,
    MAX(dm.ordem_macro) AS ordem_macro,
    MAX(dm.ordem_sub) AS ordem_sub,
    ROUND(SUM(CASE WHEN l.tipo='RECEITA' THEN COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto) ELSE 0 END)::numeric,2) AS entradas,
    ROUND(SUM(CASE WHEN l.tipo='DESPESA' THEN COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto) ELSE 0 END)::numeric,2) AS saidas,
    ROUND(SUM((CASE WHEN l.tipo='RECEITA' THEN 1 ELSE -1 END) * COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto))::numeric,2) AS net
  FROM bronze.bronze_contaazul_lancamentos l
  JOIN meta.categoria_dfc_map m ON upper(btrim(m.categoria_ca)) = upper(btrim(l.categoria_nome))
  LEFT JOIN financial.dre_categoria_macro dm ON upper(btrim(dm.categoria_nome)) = upper(btrim(l.categoria_nome))
  WHERE l.bar_id = p_bar_id AND l.excluido_em IS NULL AND m.grupo_dfc <> 'AJUSTE'
    AND l.data_pagamento >= make_date(p_ano,1,1) AND l.data_pagamento < make_date(p_ano+1,1,1)
    AND (NOT p_so_conciliado OR (l.conciliado_checado_em IS NOT NULL
         AND (l.conciliado = true OR (l.status = 'PARTIAL' AND COALESCE(l.valor_pago,0) > 0))))
  GROUP BY 1, 2, 3;
$function$;
