-- View: view_dre
-- Versao 2.0.0 - Migracao NIBO -> Conta Azul
-- Data: 2026-03-24
-- 
-- Agrega lancamentos financeiros por categoria DRE.
-- Fonte primaria: contaazul_lancamentos + contaazul_categorias
-- Fonte secundaria: dre_manual (lancamentos manuais)

CREATE OR REPLACE VIEW public.view_dre AS
WITH dados_contaazul AS (
    SELECT 
        ca.bar_id,
        EXTRACT(year FROM ca.data_competencia)::INTEGER AS ano,
        EXTRACT(month FROM ca.data_competencia)::INTEGER AS mes,
        COALESCE(cat.categoria_macro, 'Outras Despesas')::VARCHAR(100) AS categoria_macro,
        SUM(ca.valor_bruto) AS total_valor,
        COUNT(*) AS total_registros,
        'automatico'::VARCHAR(20) AS origem
    FROM contaazul_lancamentos ca
    LEFT JOIN contaazul_categorias cat 
        ON ca.categoria_nome = cat.nome 
        AND ca.bar_id = cat.bar_id
    WHERE ca.data_competencia IS NOT NULL
    GROUP BY 
        ca.bar_id,
        EXTRACT(year FROM ca.data_competencia),
        EXTRACT(month FROM ca.data_competencia),
        COALESCE(cat.categoria_macro, 'Outras Despesas')
),
dados_manuais AS (
    SELECT 
        NULL::INTEGER AS bar_id,
        EXTRACT(year FROM dre_manual.data_competencia)::INTEGER AS ano,
        EXTRACT(month FROM dre_manual.data_competencia)::INTEGER AS mes,
        dre_manual.categoria_macro::VARCHAR(100) AS categoria_macro,
        SUM(dre_manual.valor) AS total_valor,
        COUNT(*) AS total_registros,
        'manual'::VARCHAR(20) AS origem
    FROM dre_manual
    WHERE dre_manual.data_competencia IS NOT NULL
    GROUP BY 
        EXTRACT(year FROM dre_manual.data_competencia),
        EXTRACT(month FROM dre_manual.data_competencia),
        dre_manual.categoria_macro
)
SELECT bar_id, ano, mes, categoria_macro, total_valor, total_registros, origem 
FROM dados_contaazul
UNION ALL
SELECT bar_id, ano, mes, categoria_macro, total_valor, total_registros, origem 
FROM dados_manuais
ORDER BY ano DESC, mes DESC, categoria_macro;

COMMENT ON VIEW public.view_dre IS 'DRE agregada por categoria_macro. Fonte: contaazul_lancamentos + contaazul_categorias + dre_manual.';