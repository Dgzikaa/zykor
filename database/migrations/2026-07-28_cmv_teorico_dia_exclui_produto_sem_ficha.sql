-- 2026-07-28 — CMV teórico do Desempenho passa a bater com a aba CMV Teórico
--
-- Sintoma (Isaías, Deboche, 28/07): a semana 30 do Ordinário mostrava 29,77% na tabela de
-- Desempenho e 30,17% na aba CMV Teórico. Os dois números estavam "certos" — mediam bases
-- diferentes:
--
--   • gold.fn_cmv_teorico_periodo (aba)  → descarta produto SEM ficha técnica (itens_ficha = 0).
--     Regra do negócio: sem receita cadastrada o custo seria 0 e só diluiria o CMV pra baixo.
--   • gold.cmv_teorico_dia (Desempenho)  → LEFT JOIN + COALESCE(custo, 0), ou seja, o produto
--     sem ficha ENTRAVA no faturamento com custo zero. Exatamente a diluição que a regra evita.
--
-- Números da semana 30/2026 do Ordinário: R$ 2.188,90 de faturamento em 3 produtos sem ficha
-- (Feijoada Sábado R$ 2.080, Trident R$ 90, Adicional Molho R$ 18) no denominador —
-- 49.766,90/164.968,16 = 30,17% virava 49.766,78/167.157,06 = 29,77%.
--
-- Efeito da correção: o CMV teórico do Ordinário sobe entre 0,3 e 0,8 p.p. em todas as semanas
-- (para o valor correto). O Deboche não muda hoje — lá todo produto vendido tem ficha — mas
-- passaria a divergir no primeiro item sem ficha, então a correção também é prevenção.
-- Caso recorrente a vigiar: combos de evento vindos do Yuzer nascem sem ficha.

DROP MATERIALIZED VIEW IF EXISTS gold.cmv_teorico_dia;

CREATE MATERIALIZED VIEW gold.cmv_teorico_dia AS
 SELECT v.bar_id,
    v.data,
    round(sum(v.valor), 2) AS faturamento,
    round(sum(v.qtd_venda * COALESCE(cm.custo, 0::numeric)), 2) AS custo,
        CASE
            WHEN sum(v.valor) > 0::numeric THEN round(sum(v.qtd_venda * COALESCE(cm.custo, 0::numeric)) / sum(v.valor) * 100::numeric, 2)
            ELSE NULL::numeric
        END AS cmv_pct
   FROM silver.vendas_consolidada_dia v
     JOIN public.produto_cardapio pc ON pc.bar_id = v.bar_id AND pc.codigo = v.cod_interno
     LEFT JOIN gold.produto_cmv cm ON cm.bar_id = v.bar_id AND cm.produto_id = pc.id
  -- ÚNICA mudança em relação à definição anterior:
  WHERE COALESCE(cm.itens_ficha, 0) > 0
  GROUP BY v.bar_id, v.data;

-- Índice recriado com o MESMO nome: silver.fn_refresh_consumo_teorico faz REFRESH CONCURRENTLY,
-- que exige índice único. Sem ele o refresh quebra em toda edição de ficha (via recalcCmvTeorico).
CREATE UNIQUE INDEX cmv_teorico_dia_uk ON gold.cmv_teorico_dia USING btree (bar_id, data);
