-- ════════════════════════════════════════════════════════════════════
-- UNIFICAÇÃO DE STOCKOUT — 1 fórmula, 1 fonte, 1 conjunto de filtros
-- ════════════════════════════════════════════════════════════════════
-- Bug original: /ferramentas/stockout e /estrategico/desempenho mostravam
-- valores DIFERENTES de stockout pra mesma semana (semana 19/2026 bar 3):
--   Ferramentas: 13.63% bar, 11.18% comidas, 0.27% drinks
--   Desempenho:  17.58% bar, 27.91% comidas, 1.85% drinks
--
-- Causa raiz (2 problemas combinados):
--   (1) DUAS funções com FÓRMULAS diferentes:
--       silver.calcular_stockout_periodo (Desempenho) usava COUNT(DISTINCT prd)
--         = "% de produtos únicos afetados"
--       public.calcular_stockout_semanal (Ferramentas) usava COUNT(*)
--         = "% de ocorrências produto-dia em stockout"
--   (2) DUAS regras de filtro Feijoada:
--       silver.calcular_stockout_periodo excluía só 'Feijoada + Sobremesa'
--       view canônica não excluía NENHUMA feijoada
--       (No banco existem 4 produtos com "feijoada" no nome — TODOS devem
--        ser excluídos do cálculo conforme regra do negócio)
--
-- Definição CANÔNICA (escolhida pelo Rodrigo em 2026-05-12):
--   Stockout = COUNT(*) FILTER (prd_venda='N') / COUNT(*) * 100
--   ("% de ocorrências produto-dia em stockout")
--
-- Filtros CANÔNICOS:
--   - incluido = true (já estava na view)
--   - prd_desc NOT ILIKE '%feijoada%' (NOVO — exclui TODAS as feijoadas)
--   - categoria_local IN ('Drinks','Bar','Comidas') para agregados

-- ── 1. View canônica passa a excluir TODAS as feijoadas ────────────
CREATE OR REPLACE VIEW gold.gold_contahub_operacional_stockout_filtrado AS
SELECT id, raw_id, bar_id, data_consulta, hora_coleta, prd, prd_desc,
       prd_venda, prd_ativo, prd_precovenda, prd_estoque, loc_desc,
       categoria_mix, categoria_local, versao_regras, processado_em
FROM silver.silver_contahub_operacional_stockout_processado
WHERE incluido = true
  AND prd_desc NOT ILIKE '%feijoada%';

COMMENT ON VIEW gold.gold_contahub_operacional_stockout_filtrado IS
  'Fonte canônica de stockout. Filtros aplicados: incluido=true + NOT ILIKE feijoada. NUNCA usar silver.silver_contahub_operacional_stockout_processado diretamente em cálculos de stockout — sempre passar por esta view ou pelas RPCs calcular_stockout_*.';

-- ── 2. silver.calcular_stockout_periodo passa a usar a view + frequência ──
CREATE OR REPLACE FUNCTION silver.calcular_stockout_periodo(
  p_bar_id integer,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE(
  stockout_drinks_perc numeric,
  stockout_bar_perc numeric,
  stockout_comidas_perc numeric,
  stockout_total_perc numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public, gold, silver, pg_catalog
AS $$
  WITH base AS (
    SELECT
      categoria_local,
      COUNT(*)::numeric AS total,
      COUNT(*) FILTER (WHERE prd_venda = 'N')::numeric AS sem_venda
    FROM gold.gold_contahub_operacional_stockout_filtrado
    WHERE bar_id = p_bar_id
      AND data_consulta BETWEEN p_data_inicio AND p_data_fim
      AND categoria_local IN ('Drinks', 'Bar', 'Comidas')
    GROUP BY categoria_local
  ),
  totals AS (
    SELECT
      SUM(total)     FILTER (WHERE categoria_local='Drinks')  AS t_drinks,
      SUM(sem_venda) FILTER (WHERE categoria_local='Drinks')  AS s_drinks,
      SUM(total)     FILTER (WHERE categoria_local='Bar')     AS t_bar,
      SUM(sem_venda) FILTER (WHERE categoria_local='Bar')     AS s_bar,
      SUM(total)     FILTER (WHERE categoria_local='Comidas') AS t_comidas,
      SUM(sem_venda) FILTER (WHERE categoria_local='Comidas') AS s_comidas,
      SUM(total) AS t_all,
      SUM(sem_venda) AS s_all
    FROM base
  )
  SELECT
    (s_drinks  / NULLIF(t_drinks,0)  * 100)::numeric(5,2),
    (s_bar     / NULLIF(t_bar,0)     * 100)::numeric(5,2),
    (s_comidas / NULLIF(t_comidas,0) * 100)::numeric(5,2),
    (s_all     / NULLIF(t_all,0)     * 100)::numeric(5,2)
  FROM totals;
$$;

COMMENT ON FUNCTION silver.calcular_stockout_periodo IS
  'Stockout canônico — % de OCORRÊNCIAS produto-dia em stockout. Fonte: gold.gold_contahub_operacional_stockout_filtrado (exclui feijoada). Consumida por etl_gold_desempenho_semanal.';

-- ── 3. public.calcular_stockout_semanal (UI) com mesma fórmula ───────────
CREATE OR REPLACE FUNCTION public.calcular_stockout_semanal(
  p_bar_id integer,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE(categoria text, total_produtos bigint, produtos_stockout bigint, percentual_stockout numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public, gold, pg_catalog
AS $$
  SELECT
    categoria_local::text AS categoria,
    COUNT(*)::bigint AS total_produtos,
    COUNT(*) FILTER (WHERE prd_venda = 'N')::bigint AS produtos_stockout,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        COUNT(*) FILTER (WHERE prd_venda = 'N')::numeric / COUNT(*)::numeric * 100, 2
      )
      ELSE 0
    END AS percentual_stockout
  FROM gold.gold_contahub_operacional_stockout_filtrado
  WHERE bar_id = p_bar_id
    AND data_consulta BETWEEN p_data_inicio AND p_data_fim
    AND categoria_local IS NOT NULL
  GROUP BY categoria_local

  UNION ALL

  SELECT
    'Total'::text,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE prd_venda = 'N')::bigint,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        COUNT(*) FILTER (WHERE prd_venda = 'N')::numeric / COUNT(*)::numeric * 100, 2
      )
      ELSE 0
    END
  FROM gold.gold_contahub_operacional_stockout_filtrado
  WHERE bar_id = p_bar_id
    AND data_consulta BETWEEN p_data_inicio AND p_data_fim
    AND categoria_local IN ('Drinks','Bar','Comidas')

  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.calcular_stockout_semanal IS
  'Stockout canônico (UI). Mesma fórmula da silver.calcular_stockout_periodo mas retorna 1 linha por categoria + linha Total. Fonte: gold.gold_contahub_operacional_stockout_filtrado.';

-- Após apply: recalcular gold.desempenho de todas as semanas:
--   DO $$ ... etl_gold_desempenho_semanal(bar_id, ano, semana) loop ... $$;
-- (executado manualmente; 143/178 semanas recalculadas, 35 com bug overflow
--  pré-existente em outro campo numeric(5,2) não relacionado a stockout)
