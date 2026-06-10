-- 2026-06-10 | Fix DRE (financial.dre_excel) somava lançamentos EXCLUÍDOS no Conta Azul
--
-- Sintoma: aba DRE em /estrategico/orcamentacao mostrava receita inflada.
--   Ordinário (bar 3) maio/2026: 2.219.022 (deveria ser ~1,52M, que bate com o POS/ContaHub).
--
-- Causa: a view financial.dre_excel lê bronze.bronze_contaazul_lancamentos SEM filtrar
--   excluido_em. Lançamentos apagados no Conta Azul (excluido_em IS NOT NULL) continuavam
--   sendo somados. Em maio/2026 havia R$ 699.188 em receita de lançamentos excluídos
--   (2.219.022 - 699.188 = 1.519.834 ≈ 1.516.557 do POS). Demais meses praticamente sem excluídos.
--
-- Correção: filtrar excluido_em IS NULL no CTE base (aplica a receita E custos).
--
-- Obs (não tratado aqui): o mês corrente fica naturalmente subreportado na DRE porque a receita
-- de CARTÃO (Stone Crédito) só entra no CA na liquidação (~30d), com data_competencia seguindo a
-- liquidação. Para um P&L em tempo real do mês corrente, a linha de Receita deveria vir do POS
-- (ContaHub), não da competência do Conta Azul. Decisão de produto pendente.

CREATE OR REPLACE VIEW financial.dre_excel AS
 WITH lancamentos_mapeados AS (
         SELECT l.bar_id,
            date_trunc('month'::text, l.data_competencia::timestamp with time zone)::date AS mes,
            m.categoria_macro,
            m.ordem_macro,
            m.ordem_sub,
            COALESCE(NULLIF(TRIM(BOTH FROM l.categoria_nome), ''::text), 'Sem categoria'::text) AS categoria,
            m.sinal,
            sum(l.valor_bruto) AS valor
           FROM bronze.bronze_contaazul_lancamentos l
             LEFT JOIN financial.dre_categoria_macro m ON upper(TRIM(BOTH FROM m.categoria_nome)) = upper(TRIM(BOTH FROM l.categoria_nome))
          WHERE l.data_competencia >= date_trunc('year'::text, CURRENT_DATE::timestamp with time zone)
            AND l.data_competencia < (date_trunc('year'::text, CURRENT_DATE::timestamp with time zone) + '1 year'::interval)
            AND l.excluido_em IS NULL
          GROUP BY l.bar_id, (date_trunc('month'::text, l.data_competencia::timestamp with time zone)::date), m.categoria_macro, m.ordem_macro, m.ordem_sub, l.categoria_nome, m.sinal
        ), receita_mes AS (
         SELECT lancamentos_mapeados.bar_id,
            lancamentos_mapeados.mes,
            sum(lancamentos_mapeados.valor) AS receita_total
           FROM lancamentos_mapeados
          WHERE lancamentos_mapeados.categoria_macro = 'Receita'::text
          GROUP BY lancamentos_mapeados.bar_id, lancamentos_mapeados.mes
        )
 SELECT lm.bar_id,
    lm.mes,
    COALESCE(lm.categoria_macro, 'Não Mapeado'::text) AS categoria_macro,
    COALESCE(lm.ordem_macro::integer, 99) AS ordem_macro,
    COALESCE(lm.ordem_sub::integer, 99) AS ordem_sub,
    lm.categoria,
    lm.sinal,
    (lm.valor * COALESCE(lm.sinal::integer, 1)::numeric)::numeric(14,2) AS valor_com_sinal,
        CASE
            WHEN rm.receita_total > 0::numeric THEN round(lm.valor * COALESCE(lm.sinal::integer, 1)::numeric / rm.receita_total * 100::numeric, 1)
            ELSE NULL::numeric
        END AS percentual_receita
   FROM lancamentos_mapeados lm
     LEFT JOIN receita_mes rm ON rm.bar_id = lm.bar_id AND rm.mes = lm.mes;
