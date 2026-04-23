-- Fix stockout: troca fonte de silver (14 dias) para gold (137 dias)

-- ETL desempenho lia stockout de silver.silver_contahub_operacional_stockout_processado
-- que tem apenas 14 dias de dados (01/04-14/04/2026).
-- gold.gold_contahub_operacional_stockout tem 137 dias desde 27/11/2025.

-- Diferenca de schema:
-- silver tem categoria_local (Drinks/Comidas/Bar/Outro) + incluido (bool)
-- gold tem loc_desc granular (Shot e Dose, Cozinha 1, etc)
-- Mapeamento derivado via CASE WHEN usando operations.bar_local_mapeamento:
--   Drinks: Preshh, Montados, Mexido, Drinks, Drinks Autorais, Shot e Dose, Batidos
--   Comidas: Cozinha, Cozinha 1, Cozinha 2
--   Bar: Chopp, Bar
--   Excluidos: Pegue e Pague, Venda Volante, Baldes, PP

-- Rebuild: 2025 S48-S52 + 2026 S1-S17 (ambos bares)
-- Resultado: stockout populado de novembro 2025 ate abril 2026
