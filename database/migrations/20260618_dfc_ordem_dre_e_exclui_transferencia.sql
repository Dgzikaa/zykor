-- 2026-06-18 — DFC: ordena categorias na ordem da DRE + exclui transferências.
-- (1) Transferência de Entrada/Saída saem do grupo FINANCIAMENTO e vão pra AJUSTE
--     (excluídas da DFC): transferência entre contas próprias não é fluxo de caixa real.
-- (2) get_dfc_por_ano passa a devolver categoria_macro/ordem_macro/ordem_sub
--     (LEFT JOIN financial.dre_categoria_macro) pra tela mostrar as categorias na
--     MESMA ordem da DRE (Receita -> Custos Variáveis -> CMV -> Mão de Obra -> ...).

UPDATE meta.categoria_dfc_map SET grupo_dfc='AJUSTE', atualizado_em=now()
WHERE categoria_ca IN ('Transferência de Saída','Transferência de Entrada');

DROP FUNCTION IF EXISTS public.get_dfc_por_ano(integer, integer);
CREATE FUNCTION public.get_dfc_por_ano(p_bar_id integer, p_ano integer)
 RETURNS TABLE(mes date, grupo_dfc text, categoria text, categoria_macro text, ordem_macro smallint, ordem_sub smallint, entradas numeric, saidas numeric, net numeric)
 LANGUAGE sql STABLE
 SET search_path TO 'public','meta','financial','bronze','pg_catalog'
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
  GROUP BY 1, 2, 3;
$function$;
GRANT EXECUTE ON FUNCTION public.get_dfc_por_ano(integer,integer) TO authenticated, service_role, anon;
