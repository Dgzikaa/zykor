-- ============================================================
-- 2026-06-02 — RLS em tabelas internas expostas + 2 gold views (CMA mensal, Mix diário)
-- Aplicado via Supabase MCP apply_migration (mesma sessão da auditoria jun/2026).
-- ============================================================

-- 1) RLS: tabelas internas que estavam com RLS OFF e expostas ao anon key.
--    Só lidas server-side (service_role ignora RLS) -> deny-by-default p/ anon/authenticated.
ALTER TABLE gold.demanda_previsoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold.relatorios_executivos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bronze.contaazul_sync_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2) gold.cma_alimentacao_mensal — CMA (custo de alimentação) vs faturamento.
-- Grão MENSAL: custo de insumo é lançado na competência (lumpy), igual ao CMO.
-- Fonte: silver.lancamento_classificado (bloco 'Custo insumos (CMV)') + vendas_diarias.
-- NOTA: Deboche (bar_id=4) não separa custo de comida no CMV (só Bebidas/Drinks/Outros)
-- -> cma_alimentacao=0 é fiel, não perda. Ver memory contaazul_categorias_acentuacao.
-- ============================================================
CREATE OR REPLACE VIEW gold.cma_alimentacao_mensal AS
WITH cmv AS (
  SELECT bar_id,
         date_trunc('month', data_competencia::timestamptz)::date AS mes,
         sum(valor_bruto) AS cmv_total,
         sum(valor_bruto) FILTER (
           WHERE categoria_zykor ILIKE '%comida%' OR categoria_zykor ILIKE '%aliment%'
         ) AS cma_alimentacao
    FROM silver.lancamento_classificado
   WHERE is_ignorado = false
     AND bloco_dre = 'Custo insumos (CMV)'
     AND data_competencia IS NOT NULL
   GROUP BY bar_id, date_trunc('month', data_competencia::timestamptz)::date
), fat AS (
  SELECT bar_id,
         date_trunc('month', dt_gerencial::timestamptz)::date AS mes,
         sum(faturamento_liquido_r) AS faturamento_liquido
    FROM silver.vendas_diarias
   GROUP BY bar_id, date_trunc('month', dt_gerencial::timestamptz)::date
)
SELECT COALESCE(cmv.bar_id, fat.bar_id) AS bar_id,
       COALESCE(cmv.mes, fat.mes)       AS mes,
       round(COALESCE(cmv.cmv_total, 0), 2)       AS cmv_total,
       round(COALESCE(cmv.cma_alimentacao, 0), 2) AS cma_alimentacao,
       round(COALESCE(fat.faturamento_liquido, 0), 2) AS faturamento_liquido,
       CASE WHEN fat.faturamento_liquido > 0
            THEN round(COALESCE(cmv.cma_alimentacao,0) / fat.faturamento_liquido * 100, 2) END AS cma_pct,
       CASE WHEN fat.faturamento_liquido > 0
            THEN round(COALESCE(cmv.cmv_total,0) / fat.faturamento_liquido * 100, 2) END AS cmv_pct
  FROM cmv
  FULL JOIN fat ON cmv.bar_id = fat.bar_id AND cmv.mes = fat.mes
 ORDER BY 1, 2;

-- ============================================================
-- 3) gold.mix_produtos_diario — mix de vendas por dia e categoria (BEBIDA/DRINK/COMIDA).
-- Fonte: silver.vendas_item. Faturamento, quantidade, custo, margem e nº de SKUs por dia.
-- NOTA: custo só vem preenchido p/ BEBIDA na fonte -> margem_pct de DRINK/COMIDA é otimista.
-- ============================================================
CREATE OR REPLACE VIEW gold.mix_produtos_diario AS
SELECT bar_id,
       data_venda AS dt_gerencial,
       COALESCE(categoria_mix, 'SEM_CATEGORIA') AS categoria_mix,
       count(DISTINCT produto_codigo) AS skus,
       round(sum(quantidade), 2)      AS quantidade,
       round(sum(valor), 2)           AS faturamento,
       round(sum(custo), 2)           AS custo,
       round(sum(desconto), 2)        AS desconto,
       CASE WHEN sum(valor) > 0
            THEN round((sum(valor) - sum(custo)) / sum(valor) * 100, 2) END AS margem_pct
  FROM silver.vendas_item
 GROUP BY bar_id, data_venda, COALESCE(categoria_mix, 'SEM_CATEGORIA')
 ORDER BY bar_id, data_venda, categoria_mix;

GRANT SELECT ON gold.cma_alimentacao_mensal TO anon, authenticated, service_role;
GRANT SELECT ON gold.mix_produtos_diario    TO anon, authenticated, service_role;
