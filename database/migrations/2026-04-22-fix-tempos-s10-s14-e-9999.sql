-- Fix tempos S10-S14 + LEAST 9999 -> CASE WHEN NULL

-- Causa raiz: adapter_contahub_to_tempos_producao nao havia re-rodado
-- para o periodo 02/03 a 07/04. Bronze tinha dados validos (40k+ registros
-- com t0_t3 100-400s) mas operations/silver tinha tudo zerado.

-- Fix: reprocessamento adapter para 37 dias (02/03 a 07/04) ambos bares
-- DO $$ ... adapter_contahub_to_tempos_producao(bar, dia) ... $$

-- Apos reprocessamento, rebuild gold.desempenho S10-S17 ambos bares.
-- Tempos recuperados: cozinha ~600-850s, drinks ~130-250s (S10-S14)

-- Fix ETL 9999 -> NULL:
-- ANTES: LEAST(AVG(t0_t3) FILTER (...), 9999)::numeric(8,2)
-- DEPOIS: CASE WHEN COUNT(*) FILTER (...) > 0 THEN AVG(...) ELSE NULL END
-- Aplicado nos 3 campos: tempo_drinks, tempo_bebidas, tempo_cozinha
-- Evita que gaps futuros mostrem 9999 na tela
