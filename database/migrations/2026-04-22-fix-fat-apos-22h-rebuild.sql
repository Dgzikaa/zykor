-- Fix perc_faturamento_apos_22h: rebuild planejamento + desempenho

-- Causa: ETL planejamento tem fat_apos_22h no codigo mas so havia rodado
-- a partir de 30/03/2026 (quando campo foi adicionado). Semanas anteriores
-- ficaram com NULL no gold.desempenho.

-- Bronze bronze_contahub_avendas_vendasdiahoraanalitico tinha dados desde
-- 02/01/2026 (390 registros hora>=22, R$1M faturamento).

-- Fix: rebuild gold.planejamento 2025+2026 inteiro (ambos bares)
-- + rebuild gold.desempenho 2025 S1-S52 + 2026 S1-S17

-- Resultado: perc_faturamento_apos_22h populado em todas semanas
-- 2026 S1-S17: 28-46% (antes: NULL S1-S13)
-- 2025 S10-S52: 18-40% (S1-S9 NULL por falta de dados bronze)
