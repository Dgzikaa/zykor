-- 2026-06-17 — Mix de Vendas (Desempenho) passa a incluir Yuzer
--
-- Antes o Mix de Vendas (% por valor + quantidade de Bebida/Drink/Comida) vinha
-- só do ContaHub (silver.vendas_item), então semanas/meses com evento no Yuzer
-- (ex.: jogo da Copa) ficavam subestimadas — o evento não passa pelo ContaHub.
--
-- Regra (confirmada pelo sócio): no DIA de evento Yuzer usa-se o Yuzer e ignora-se
-- o ContaHub daquele dia (o ContaHub do dia é ~R$0/comps); nos demais dias, ContaHub.
-- Soma tudo na semana/mês. Mapeamento Yuzer subcategoria->categoria igual ao
-- evento_cesta_detalhe (usado na tela /eventos). Em semanas SEM Yuzer o resultado
-- é IDÊNTICO ao gold (mesma fórmula, % por valor).
--
-- Os RPCs novos devolvem valor E quantidade por categoria. O frontend do Desempenho
-- (desempenho-service.ts e desempenho-mensal-service.ts) passou a usá-los, calculando
-- perc_* (por valor) e qtd_*, sobrescrevendo o perc_* do gold.desempenho (só ContaHub).

CREATE OR REPLACE FUNCTION public.get_mix_por_semana(p_bar_id integer, p_ano integer)
 RETURNS TABLE(ano integer, numero_semana integer,
   val_bebida numeric, val_drink numeric, val_comida numeric,
   qtd_bebida numeric, qtd_drink numeric, qtd_comida numeric)
 LANGUAGE sql STABLE
 SET search_path TO 'public','silver','operations','pg_catalog'
AS $function$
  WITH yuzer_dias AS (
    SELECT DISTINCT data_evento AS dia FROM silver.yuzer_produtos_evento WHERE bar_id = p_bar_id
  ),
  ch AS (
    SELECT data_venda AS dia, categoria_mix AS cat, valor, quantidade
    FROM silver.vendas_item vi
    WHERE vi.bar_id = p_bar_id
      AND vi.data_venda >= make_date(p_ano-1,12,26) AND vi.data_venda < make_date(p_ano+1,1,6)
      AND vi.tipo_transacao IN ('venda integral','com desconto','100% desconto')
      AND vi.categoria_mix IN ('BEBIDA','DRINK','COMIDA')
      AND vi.data_venda NOT IN (SELECT dia FROM yuzer_dias)
  ),
  yz AS (
    SELECT data_evento AS dia,
      CASE
        WHEN produto_nome ILIKE '%eco%copo%' THEN NULL
        WHEN eh_ingresso OR upper(COALESCE(subcategoria,'')) = 'BILHETERIA' THEN NULL
        WHEN upper(COALESCE(subcategoria,'')) = 'COMIDAS' THEN 'COMIDA'
        WHEN upper(COALESCE(subcategoria,'')) IN ('CERVEJA','BEBIDAS') THEN 'BEBIDA'
        WHEN upper(COALESCE(subcategoria,'')) LIKE '%ALC%' THEN 'BEBIDA'
        WHEN upper(COALESCE(subcategoria,'')) IN ('DRINKS','DRINKS AUTORAIS','DOSES','COMBO','COMBOS','GARRAFAS') THEN 'DRINK'
        ELSE NULL
      END AS cat,
      valor_total AS valor, quantidade
    FROM silver.yuzer_produtos_evento
    WHERE bar_id = p_bar_id
      AND data_evento >= make_date(p_ano-1,12,26) AND data_evento < make_date(p_ano+1,1,6)
  ),
  todos AS (
    SELECT dia, cat, valor, quantidade FROM ch
    UNION ALL
    SELECT dia, cat, valor, quantidade FROM yz WHERE cat IS NOT NULL
  )
  SELECT EXTRACT(isoyear FROM dia)::int, EXTRACT(week FROM dia)::int,
    COALESCE(SUM(valor) FILTER (WHERE cat='BEBIDA'),0)::numeric,
    COALESCE(SUM(valor) FILTER (WHERE cat='DRINK'),0)::numeric,
    COALESCE(SUM(valor) FILTER (WHERE cat='COMIDA'),0)::numeric,
    COALESCE(SUM(quantidade) FILTER (WHERE cat='BEBIDA'),0)::numeric,
    COALESCE(SUM(quantidade) FILTER (WHERE cat='DRINK'),0)::numeric,
    COALESCE(SUM(quantidade) FILTER (WHERE cat='COMIDA'),0)::numeric
  FROM todos
  WHERE EXTRACT(isoyear FROM dia) = p_ano
  GROUP BY 1,2;
$function$;
GRANT EXECUTE ON FUNCTION public.get_mix_por_semana(integer,integer) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.get_mix_por_mes(p_bar_id integer, p_ano integer)
 RETURNS TABLE(ano integer, mes integer,
   val_bebida numeric, val_drink numeric, val_comida numeric,
   qtd_bebida numeric, qtd_drink numeric, qtd_comida numeric)
 LANGUAGE sql STABLE
 SET search_path TO 'public','silver','operations','pg_catalog'
AS $function$
  WITH yuzer_dias AS (
    SELECT DISTINCT data_evento AS dia FROM silver.yuzer_produtos_evento WHERE bar_id = p_bar_id
  ),
  ch AS (
    SELECT data_venda AS dia, categoria_mix AS cat, valor, quantidade
    FROM silver.vendas_item vi
    WHERE vi.bar_id = p_bar_id
      AND vi.data_venda >= make_date(p_ano,1,1) AND vi.data_venda < make_date(p_ano+1,1,1)
      AND vi.tipo_transacao IN ('venda integral','com desconto','100% desconto')
      AND vi.categoria_mix IN ('BEBIDA','DRINK','COMIDA')
      AND vi.data_venda NOT IN (SELECT dia FROM yuzer_dias)
  ),
  yz AS (
    SELECT data_evento AS dia,
      CASE
        WHEN produto_nome ILIKE '%eco%copo%' THEN NULL
        WHEN eh_ingresso OR upper(COALESCE(subcategoria,'')) = 'BILHETERIA' THEN NULL
        WHEN upper(COALESCE(subcategoria,'')) = 'COMIDAS' THEN 'COMIDA'
        WHEN upper(COALESCE(subcategoria,'')) IN ('CERVEJA','BEBIDAS') THEN 'BEBIDA'
        WHEN upper(COALESCE(subcategoria,'')) LIKE '%ALC%' THEN 'BEBIDA'
        WHEN upper(COALESCE(subcategoria,'')) IN ('DRINKS','DRINKS AUTORAIS','DOSES','COMBO','COMBOS','GARRAFAS') THEN 'DRINK'
        ELSE NULL
      END AS cat,
      valor_total AS valor, quantidade
    FROM silver.yuzer_produtos_evento
    WHERE bar_id = p_bar_id
      AND data_evento >= make_date(p_ano,1,1) AND data_evento < make_date(p_ano+1,1,1)
  ),
  todos AS (
    SELECT dia, cat, valor, quantidade FROM ch
    UNION ALL
    SELECT dia, cat, valor, quantidade FROM yz WHERE cat IS NOT NULL
  )
  SELECT p_ano, EXTRACT(month FROM dia)::int,
    COALESCE(SUM(valor) FILTER (WHERE cat='BEBIDA'),0)::numeric,
    COALESCE(SUM(valor) FILTER (WHERE cat='DRINK'),0)::numeric,
    COALESCE(SUM(valor) FILTER (WHERE cat='COMIDA'),0)::numeric,
    COALESCE(SUM(quantidade) FILTER (WHERE cat='BEBIDA'),0)::numeric,
    COALESCE(SUM(quantidade) FILTER (WHERE cat='DRINK'),0)::numeric,
    COALESCE(SUM(quantidade) FILTER (WHERE cat='COMIDA'),0)::numeric
  FROM todos
  GROUP BY 2;
$function$;
GRANT EXECUTE ON FUNCTION public.get_mix_por_mes(integer,integer) TO authenticated, service_role, anon;
