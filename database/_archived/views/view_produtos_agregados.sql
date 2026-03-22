-- View otimizada para produtos agregados
-- Substitui o processamento pesado de 100k+ registros por uma view pré-calculada

CREATE OR REPLACE VIEW view_produtos_agregados AS
SELECT 
    prd_desc as produto,
    grp_desc as grupo,
    bar_id,
    EXTRACT(DOW FROM trn_dtgerencial) as dia_semana,
    COUNT(*) as total_vendas,
    SUM(qtd) as quantidade_total,
    SUM(valorfinal) as valor_total,
    SUM(custo) as custo_total,
    AVG(valorfinal) as valor_medio,
    MIN(trn_dtgerencial) as primeira_venda,
    MAX(trn_dtgerencial) as ultima_venda,
    -- Calcular margem de lucro
    CASE 
        WHEN SUM(valorfinal) > 0 THEN 
            ((SUM(valorfinal) - SUM(custo)) / SUM(valorfinal)) * 100
        ELSE 0 
    END as margem_lucro_percentual
FROM contahub_analitico
WHERE 
    prd_desc IS NOT NULL 
    AND prd_desc != ''
    AND qtd IS NOT NULL
    AND valorfinal IS NOT NULL
    AND bar_id IS NOT NULL
GROUP BY 
    prd_desc, 
    grp_desc, 
    bar_id,
    EXTRACT(DOW FROM trn_dtgerencial)
ORDER BY 
    valor_total DESC;

-- Índices para otimizar performance
CREATE INDEX IF NOT EXISTS idx_produtos_agregados_bar_dia 
ON contahub_analitico(bar_id, EXTRACT(DOW FROM trn_dtgerencial)) 
WHERE prd_desc IS NOT NULL AND prd_desc != '';

CREATE INDEX IF NOT EXISTS idx_produtos_agregados_produto 
ON contahub_analitico(prd_desc, grp_desc) 
WHERE prd_desc IS NOT NULL AND prd_desc != '';

-- Comentários para documentação
COMMENT ON VIEW view_produtos_agregados IS 'View otimizada para análise de produtos - agrega dados por produto, grupo, bar e dia da semana';
COMMENT ON COLUMN view_produtos_agregados.produto IS 'Nome do produto (prd_desc)';
COMMENT ON COLUMN view_produtos_agregados.grupo IS 'Grupo do produto (grp_desc)';
COMMENT ON COLUMN view_produtos_agregados.dia_semana IS 'Dia da semana (0=domingo, 1=segunda, etc.)';
COMMENT ON COLUMN view_produtos_agregados.margem_lucro_percentual IS 'Margem de lucro em percentual';
