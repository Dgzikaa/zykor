-- Fix tm_entrada/tm_bar regressao + cron saude
-- Aplicado diretamente no banco via CREATE OR REPLACE em 2026-04-22

-- 1. ETL gold desempenho semanal: formulas ticket corrigidas
-- ANTES (errado - regressao do v3):
--   NULLIF(AVG(te_real_calculado) FILTER (...), 0) as ticket_medio
--   NULLIF(AVG(te_real_calculado) FILTER (...), 0) as tm_entrada  -- DUPLICADO!
--   NULLIF(AVG(tb_real_calculado) FILTER (...), 0) as tm_bar
-- DEPOIS (correto):
--   (SUM(faturamento_total_consolidado) / NULLIF(SUM(publico_real_consolidado), 0)) as ticket_medio
--   (SUM(faturamento_couvert) / NULLIF(SUM(publico_real_consolidado), 0)) as tm_entrada
--   ((SUM(fat_total) - SUM(couvert)) / NULLIF(SUM(publico), 0)) as tm_bar
-- Validado: S15/26 = 103.70 / 18.86 / 84.84

-- 2. Cron saude: referencia atualizada
-- ANTES: meta.desempenho_semanal (tabela renomeada, falhava silenciosamente)
-- DEPOIS: gold.desempenho com filtro granularidade='semanal' + calculado_em

-- Rebuild executado: 2025 S1-S52 + 2026 S1-S17 (ambos bares)
