-- Qtd de itens que saíram por dia, para a seção PRODUÇÃO do Planejamento Comercial.
-- Pedido do Cadu (31/07/2026): "quantidade de itens que saíram por dia".
--
-- Fonte: silver.vendas_consolidada_dia — a MESMA que alimenta CMV teórico, plano de produção
-- e desvios. Escolhida por três motivos:
--   1. já exclui os lançamentos internos "[IN] ..." (grupo Insumos), que não são venda a
--      cliente e sozinhos somam 1.736 un num sábado do Ordinário — quase dobrariam o número;
--   2. já consolida Yuzer + ContaHub em dia de evento (FULL OUTER JOIN, mantendo a cortesia
--      que o Yuzer não captura);
--   3. separa qtd_consumo (tudo que SAIU, inclusive cortesia) de qtd_venda (só o pago).
--
-- A coluna da tela usa qtd_consumo: para produção, o prato de cortesia foi preparado igual.
-- qtd_venda vai junto para quem quiser o pago (e a diferença é a cortesia do dia).
--
-- Agregação no banco, não no cliente: um mês tem ~6 mil linhas produto×dia e o PostgREST
-- corta em 1000 — somar no front sairia silenciosamente errado.
CREATE OR REPLACE FUNCTION public.get_itens_vendidos_periodo(
  p_bar_id integer,
  p_ini date,
  p_fim date
)
RETURNS TABLE(data date, qtd_itens numeric, qtd_itens_pagos numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'silver', 'pg_catalog'
AS $function$
  SELECT v.data,
         ROUND(SUM(v.qtd_consumo), 2) AS qtd_itens,
         ROUND(SUM(v.qtd_venda), 2)   AS qtd_itens_pagos
  FROM silver.vendas_consolidada_dia v
  WHERE v.bar_id = p_bar_id
    AND v.data >= p_ini
    AND v.data <= p_fim
  GROUP BY v.data;
$function$;

COMMENT ON FUNCTION public.get_itens_vendidos_periodo(integer, date, date) IS
  'Itens vendidos por dia (qtd_consumo = com cortesia; qtd_venda = só pago), de silver.vendas_consolidada_dia. Usado na seção Produção do Planejamento Comercial.';

-- anon NÃO executa (hardening de grants); a tela lê pelo service role, e authenticated
-- fica liberado para uso direto do PostgREST se algum outro lugar precisar.
REVOKE ALL ON FUNCTION public.get_itens_vendidos_periodo(integer, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_itens_vendidos_periodo(integer, date, date) TO authenticated, service_role;
