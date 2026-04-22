-- Fix perc_faturamento_ate_19h: incluir hora 16:00

-- Bug: ETL planejamento somava apenas horas 17:00 e 18:00 (2 horas)
-- Excel usa horas 16:00, 17:00 e 18:00 (3 horas)
-- Resultado: gold mostrava ~11% quando deveria ser ~13-16%

-- ANTES: SUM(valor) FILTER (WHERE hora IN ('17:00', '18:00'))
-- DEPOIS: SUM(valor) FILTER (WHERE hora IN ('16:00', '17:00', '18:00'))

-- Nota: divergencia residual (gold 12.88% vs Excel 16.1%) e metodologica:
-- - Gold usa AVG dos percentuais diarios (cada dia pesa igual)
-- - Excel usa SUM(fat_19h) / SUM(fat_total) agregado (dias pesam proporcional)
-- Decisao pendente sobre qual metodo adotar.

-- Rebuild: planejamento 2025+2026 (ambos bares) + desempenho completo
