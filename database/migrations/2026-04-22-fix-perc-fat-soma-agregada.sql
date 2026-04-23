-- Fix perc_faturamento_ate_19h e apos_22h: AVG diaria -> SOMA AGREGADA

-- Bug: ETL desempenho calculava AVG(fat_19h_percent) dos dias do planejamento.
-- Cada dia pesava igual independente do volume. Excel usa soma agregada
-- (SUM numerador / SUM denominador) que pondera por volume.

-- Fix: nova CTE fase_fat_hora no ETL desempenho_semanal que le direto
-- do bronze.bronze_contahub_avendas_vendasdiahoraanalitico e calcula
-- SUM(horas 16-17-18) / SUM(total) * 100 como soma agregada.

-- Resultado S16 bar 3:
-- perc_fat_ate_19h: 12.88% (AVG) -> 15.89% (SUM) [Excel 16.1%]
-- perc_fat_apos_22h: 35.28% (AVG) -> 33.42% (SUM) [bate com bronze direto]

-- Gold agora bate exatamente com calculo direto do bronze.

-- Rebuild: 2025 S1-S52 + 2026 S1-S17 (ambos bares)
