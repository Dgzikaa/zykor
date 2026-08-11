-- =============================================================================
-- Preço do insumo passa a preferir pedido ENTREGUE — 11/08/2026
-- =============================================================================
--
-- gold.vmarket_insumo_preco pegava o preço do pedido mais RECENTE, sem olhar se ele foi
-- entregue. Qualquer pedido lançado — inclusive um que nunca chegou, ou com preço digitado
-- errado na cotação — virava o custo do insumo, e daí contaminava CMV teórico, desvios e a
-- valorização de estoque.
--
-- CASO QUE REVELOU (Ordinário, auditoria do CMV): "Linguiça Toscana Suína" estava a
-- R$ 91,50/kg, vinda de um pedido de 10/08 com status "Pedido realizado - aguardando
-- fornecedor". Os pedidos ENTREGUES do mesmo insumo estavam entre R$ 12,51 e R$ 16,49.
-- Efeito em cascata: o preparo "Choripan" (200 g de linguiça) custava R$ 18,30 só de
-- linguiça, e o prato Choripan aparecia com CMV de 66,6%.
-- Depois da correção: custo do Choripan R$ 22,63 → R$ 7,42 (CMV 66,6% → 21,9%).
--
-- TAMANHO DO PROBLEMA quando medido: 73 de 405 insumos do bar 3 (18%) e 29 de 244 do bar 4
-- (12%) tinham o preço vindo de pedido não entregue. Com distorção relevante (fora da faixa
-- 0,6x–1,7x contra o último entregue) eram 5 — mas cada um deles distorcia um prato inteiro.
--
-- CORREÇÃO: os entregues passam à frente na ordenação. Um pedido não entregue só é usado se
-- NÃO existir nenhuma entrega daquele insumo — assim não se perde cobertura de preço em
-- insumo comprado pela primeira vez. (Sem preço o custo viraria 0 e o CMV seria subestimado,
-- que é o erro oposto e mais silencioso.)
--
-- Depois de aplicar:
--   select gold.fn_cmv_teorico(3); select gold.fn_cmv_teorico(4);
--   select gold.fn_rebuild_produto_cmv_historico(3, '2026-06-01', current_date);
--   select gold.fn_rebuild_produto_cmv_historico(4, '2026-06-01', current_date);
--   select silver.fn_refresh_vendas_depara();
-- =============================================================================

create or replace view gold.vmarket_insumo_preco as
 WITH hist AS (
         SELECT i.bar_id,
            i.id_produto_sisfood_cotacao AS id_prod,
            p.dt_inclusao,
            i.preco,
            COALESCE(NULLIF(p.nome_fantasia, ''::text), p.razao_social) AS fornecedor,
            row_number() OVER (
              PARTITION BY i.bar_id, i.id_produto_sisfood_cotacao
              -- entregue primeiro; só depois o mais recente
              ORDER BY (p.dt_entrega IS NOT NULL) DESC,
                       p.dt_inclusao DESC NULLS LAST,
                       i.id_pedido_item DESC) AS rn
           FROM bronze_vmarket_pedido_itens i
             JOIN bronze_vmarket_pedidos p ON p.bar_id = i.bar_id AND p.id_pedido = i.id_pedido
          WHERE i.preco IS NOT NULL AND i.preco > 0::numeric
        )
 SELECT bar_id,
    id_prod,
    max(CASE WHEN rn = 1 THEN preco ELSE NULL::numeric END) AS preco_atual,
    max(CASE WHEN rn = 1 THEN dt_inclusao ELSE NULL::timestamp without time zone END) AS data_atual,
    max(CASE WHEN rn = 1 THEN fornecedor ELSE NULL::text END) AS fornecedor_atual,
    max(CASE WHEN rn = 2 THEN preco ELSE NULL::numeric END) AS preco_anterior,
    max(CASE WHEN rn = 2 THEN dt_inclusao ELSE NULL::timestamp without time zone END) AS data_anterior
   FROM hist
  WHERE rn <= 2
  GROUP BY bar_id, id_prod;
