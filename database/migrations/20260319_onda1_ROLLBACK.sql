-- =====================================================
-- ROLLBACK ONDA 1: CONFIGURAÇÃO CENTRALIZADA POR BAR
-- USAR APENAS SE NECESSÁRIO
-- =====================================================

-- 1. DROPAR FUNÇÕES
DROP FUNCTION IF EXISTS get_cmv_fator_consumo(INTEGER);
DROP FUNCTION IF EXISTS get_ano_inicio_operacao(INTEGER);
DROP FUNCTION IF EXISTS get_categorias_custo(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS get_metas_dia(INTEGER, INTEGER);

-- 2. DROPAR TABELAS (cuidado: dados serão perdidos)
DROP TABLE IF EXISTS bar_metas_periodo;
DROP TABLE IF EXISTS bar_categorias_custo;
DROP TABLE IF EXISTS bar_regras_negocio;

-- 3. ROLLBACK DO CÓDIGO
-- git checkout HEAD~1 -- frontend/src/lib/dateHelpers.ts
-- git checkout HEAD~1 -- frontend/src/lib/eventos-rules.ts
-- git checkout HEAD~1 -- backend/supabase/functions/cmv-semanal-auto/index.ts
-- git checkout HEAD~1 -- backend/supabase/functions/_shared/calculators/calc-custos.ts
-- git checkout HEAD~1 -- frontend/src/app/api/config/bar/[barId]/regras/route.ts
-- git checkout HEAD~1 -- frontend/src/app/api/config/bar/[barId]/metas/route.ts
