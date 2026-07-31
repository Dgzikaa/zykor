-- Qtd Itens agora quebrada em bebida / drink / cozinha (pedido do Gonza via Rodrigo, 31/07/2026:
-- "precisava ser dividido em bebida, drink e cozinha pra saber quanto saiu de cada").
-- Estende 2026-07-31_itens_vendidos_dia_planejamento.sql, do mesmo dia.
--
-- A CLASSIFICAÇÃO vem da 1ª letra do `cod_interno` (b=bebida, d=drink, c=comida/cozinha, o=outros),
-- que é o mesmo de-para usado pelas fichas técnicas e pelo CMV. Foi a única régua que cobriu 100%
-- dos itens: classificar por GRUPO do ContaHub (silver.vendas_item.categoria_mix) deixa de fora
-- os dois maiores grupos do Ordinário, que não estão em public.grupo_categoria_classificacao —
-- "Pegue e Pague" (3.271 un em julho/26, R$ 72k) e "50%" (1.257 un, happy hour). Juntos são ~16%
-- dos itens, e cada um mistura categorias: em "50%" há drink E cerveja; em "Pegue e Pague" há
-- água/cerveja E caipirinha. Por grupo, esses 4.528 itens virariam "sem classificação"; pelo
-- código, cada um cai na sua categoria.
--
-- Conferido em 30/07/2026 (bar 3): 1.589 bebida + 438 drink + 158 cozinha + 43 outros = 2.228,
-- exatamente o `qtd_itens` que a coluna já mostra — a quebra fecha com o total, sem resto.
-- Também validado no Deboche (bar 4), onde o de-para cobre igual.
--
-- Os % de mix ao lado na tela (percent_b/d/c do gold) usam outra régua — por VALOR e por grupo.
-- Dão resultado próximo (30/07: 61,9/23,1/15,1 contra 63,6/22,3/14,1 por aqui), mas são coisas
-- diferentes: um é participação no faturamento, o outro é unidade que saiu.
--
-- DROP+CREATE porque RETURNS TABLE ganhou colunas (CREATE OR REPLACE não permite). As colunas
-- antigas continuam com o mesmo nome e ordem, então a versão da tela que está no ar não quebra.
DROP FUNCTION IF EXISTS public.get_itens_vendidos_periodo(integer, date, date);

CREATE FUNCTION public.get_itens_vendidos_periodo(
  p_bar_id integer,
  p_ini date,
  p_fim date
)
RETURNS TABLE(
  data date,
  qtd_itens numeric,
  qtd_itens_pagos numeric,
  qtd_bebida numeric,
  qtd_drink numeric,
  qtd_cozinha numeric,
  qtd_outros numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'silver', 'pg_catalog'
AS $function$
  SELECT v.data,
         ROUND(SUM(v.qtd_consumo), 2) AS qtd_itens,
         ROUND(SUM(v.qtd_venda), 2)   AS qtd_itens_pagos,
         ROUND(SUM(v.qtd_consumo) FILTER (WHERE LEFT(LOWER(v.cod_interno), 1) = 'b'), 2) AS qtd_bebida,
         ROUND(SUM(v.qtd_consumo) FILTER (WHERE LEFT(LOWER(v.cod_interno), 1) = 'd'), 2) AS qtd_drink,
         ROUND(SUM(v.qtd_consumo) FILTER (WHERE LEFT(LOWER(v.cod_interno), 1) = 'c'), 2) AS qtd_cozinha,
         -- tudo que não é b/d/c (inclui 'o' de outros e código ausente) — some no total, então
         -- precisa existir para bebida+drink+cozinha+outros fechar com qtd_itens.
         ROUND(SUM(v.qtd_consumo) FILTER (WHERE COALESCE(LEFT(LOWER(v.cod_interno), 1), '?') NOT IN ('b','d','c')), 2) AS qtd_outros
  FROM silver.vendas_consolidada_dia v
  WHERE v.bar_id = p_bar_id
    AND v.data >= p_ini
    AND v.data <= p_fim
  GROUP BY v.data;
$function$;

COMMENT ON FUNCTION public.get_itens_vendidos_periodo(integer, date, date) IS
  'Itens vendidos por dia (qtd_consumo = com cortesia; qtd_venda = só pago), quebrados em bebida/drink/cozinha/outros pela 1ª letra do cod_interno (mesmo de-para das fichas). Seção Produção do Planejamento Comercial.';

REVOKE ALL ON FUNCTION public.get_itens_vendidos_periodo(integer, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_itens_vendidos_periodo(integer, date, date) TO authenticated, service_role;
