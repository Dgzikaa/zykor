-- Fix NPS: score real por tipo de pesquisa Falae

-- 1. nps_geral removido do ETL (NULL no INSERT). Campo existe
--    em gold.desempenho e meta mas tem muitas refs no codigo.
--    Manter coluna, nao calcular automaticamente.

-- 2. Silver: etl_silver_nps_diario_full agrega por
--    (created_at AT TIME ZONE 'America/Sao_Paulo')::date
--    em vez de COALESCE(data_visita, created_at::date).
--    Alinha com Falae web (data da resposta).

-- 3. Gold: nps_digital e nps_salao agora calculam NPS score
--    real direto do bronze.bronze_falae_respostas:
--    - nps_digital: WHERE search_name = 'NPS Digital'
--    - nps_salao: WHERE search_name = 'Salão'
--    Formula: (promotores - detratores) * 100 / total
--    Antes: media ponderada de nps_medio (nota 0-10) via JSONB

-- S16 bar 3: nps_digital 9.11 (nota media) -> 75.00 (score real)
-- Falae web: 69.2 (ter-seg 14-20/04). Diff = janela seg-dom vs ter-seg.

-- Rebuild: 2025 S48-S52 + 2026 S1-S17 (ambos bares)
