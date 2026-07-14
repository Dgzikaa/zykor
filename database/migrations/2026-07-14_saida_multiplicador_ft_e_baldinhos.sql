-- 2026-07-14 — #7 (Gonza): SAÍDA/consumo teórico não considerava o multiplicador (nº de
-- porções) da ficha de FINALIZAÇÃO. Ex.: Mega Coxinha (5x) consumia 1 coxinha/venda em vez
-- de 5 → 9 vendas davam saída 9 (deveria 45).
--
-- Aplicar o multiplicador na saída é correto para produtos cuja FT é escrita POR 1 UNIDADE
-- (comida: coxinha/dadinho/croquetão; cocktails [DD]; [DD] cervejas com ficha = 1 porção; o
-- "balde" do Deboche b0103 = 600ml/unidade). MAS os baldinhos multipack do Ordinário têm a FT
-- com a QUANTIDADE CHEIA (ex.: Stella 4Un = 2400ml = 4×600) + multiplicador — aplicar ×N ali
-- dobraria (e o CMV teórico deles já estava inflado ~4× pela mesma razão).
--
-- CORREÇÃO (aprovada pelo dono 14/07): FT cheia = multiplicador redundante → zera (=1) nos 9
-- baldinhos do bar 3; depois aplica o multiplicador no nível 0 das views de saída. Isso conserta
-- a saída da coxinha/comida/cocktails E o CMV teórico inflado dos baldinhos, sem double-count.

-- 1) DADO: baldinhos (bar 3) com FT já cheia → multiplicador = 1.
UPDATE public.produto_cardapio SET multiplicador = 1
WHERE bar_id = 3 AND codigo IN
  ('b0110','b0159','b0198','b0200','b0202','b0205','b0206','b0208','b0233');

-- 2) SAÍDA: multiplicador do produto no NÍVEL 0 (finalização) das duas views de explosão.
CREATE OR REPLACE VIEW silver.producao_por_produto AS
 WITH RECURSIVE expl AS (
         SELECT pc_1.bar_id,
            pc_1.id AS raiz,
            fi.componente_tipo,
            fi.producao_ref,
            COALESCE(fi.quantidade, 0::numeric) / COALESCE(NULLIF(fi.fator_correcao, 0::numeric), 1::numeric)
              * COALESCE(pc_1.multiplicador, 1::numeric) AS ef_qtd,
            1::numeric AS fator_pai,
            0 AS lvl
           FROM produto_cardapio pc_1
             JOIN producao_ficha_item fi ON fi.produto_id = pc_1.id
        UNION ALL
         SELECT e_1.bar_id,
            e_1.raiz,
            fi.componente_tipo,
            fi.producao_ref,
            COALESCE(fi.quantidade, 0::numeric) / COALESCE(NULLIF(fi.fator_correcao, 0::numeric), 1::numeric) AS ef_qtd,
            e_1.fator_pai * (e_1.ef_qtd / NULLIF(pb_1.rendimento, 0::numeric)),
            e_1.lvl + 1
           FROM expl e_1
             JOIN producao_base pb_1 ON pb_1.id = e_1.producao_ref
             JOIN producao_ficha_item fi ON fi.producao_id = e_1.producao_ref
          WHERE e_1.componente_tipo = 'producao'::text AND e_1.lvl < 6
        )
 SELECT e.bar_id,
    e.raiz AS produto_id,
    pc.codigo AS produto_cod,
    pb.codigo AS producao_cod,
    pb.nome AS producao_nome,
    pb.unidade,
    sum(e.ef_qtd * e.fator_pai) AS qtd_por_produto
   FROM expl e
     JOIN produto_cardapio pc ON pc.id = e.raiz
     JOIN producao_base pb ON pb.id = e.producao_ref
  WHERE e.componente_tipo = 'producao'::text AND e.producao_ref IS NOT NULL
  GROUP BY e.bar_id, e.raiz, pc.codigo, pb.codigo, pb.nome, pb.unidade;

CREATE OR REPLACE VIEW silver.insumo_por_produto AS
 SELECT pc.bar_id,
    pc.id AS produto_id,
    pc.codigo AS produto_cod,
    fi.insumo_codigo,
    sum(COALESCE(fi.quantidade, 0::numeric) / COALESCE(NULLIF(fi.fator_correcao, 0::numeric), 1::numeric)
        * COALESCE(pc.multiplicador, 1::numeric)) AS qtd_por_produto
   FROM produto_cardapio pc
     JOIN producao_ficha_item fi ON fi.produto_id = pc.id
  WHERE fi.componente_tipo = 'insumo'::text AND fi.insumo_codigo IS NOT NULL
  GROUP BY pc.bar_id, pc.id, pc.codigo, fi.insumo_codigo;

-- 3) Recalcula o CMV teórico do bar 3 (gold.produto_cmv: custo total = custo_unit × multiplicador;
--    baldinhos deixam de inflar). fn_cmv_teorico lê o multiplicador de produto_cardapio.
SELECT gold.fn_cmv_teorico(3);

-- 4) Refresh das matviews de consumo/CMV que dependem das views/multiplicador.
REFRESH MATERIALIZED VIEW silver.consumo_producao_dia;
REFRESH MATERIALIZED VIEW silver.consumo_teorico_insumo_dia;
REFRESH MATERIALIZED VIEW gold.cmv_teorico_dia;
