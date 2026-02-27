-- ============================================================
-- CORREÇÃO COMPLETA: VISÃO GERAL ESTRATÉGICA
-- ============================================================
-- Este script corrige o cálculo de Clientes Ativos na Visão Geral
-- Adiciona campo base_ativa_90d e configura atualização automática
-- ============================================================

-- PASSO 1: Recriar view com campo base_ativa_90d
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS public.view_visao_geral_trimestral CASCADE;

CREATE MATERIALIZED VIEW public.view_visao_geral_trimestral AS
WITH keys AS (
  SELECT DISTINCT bar_id,
         extract(year from dt_gerencial)::int as ano,
         ((extract(month from dt_gerencial)::int - 1) / 3 + 1)::int as trimestre
  FROM public.contahub_periodo
  WHERE dt_gerencial >= '2024-01-01'
),
clientes_unicos AS (
  SELECT bar_id,
         extract(year from dt_gerencial)::int as ano,
         ((extract(month from dt_gerencial)::int - 1) / 3 + 1)::int as trimestre,
         COUNT(DISTINCT cli_fone)::numeric as clientes_totais
  FROM public.contahub_periodo
  WHERE cli_fone IS NOT NULL
    AND LENGTH(cli_fone) >= 8
    AND dt_gerencial >= '2024-01-01'
  GROUP BY 1,2,3
),
base_ativa AS (
  SELECT 
    k.bar_id,
    k.ano,
    k.trimestre,
    COUNT(DISTINCT cp.cli_fone)::numeric as base_ativa_90d
  FROM keys k
  CROSS JOIN LATERAL (
    SELECT CASE k.trimestre
      WHEN 1 THEN (k.ano || '-03-31')::DATE
      WHEN 2 THEN (k.ano || '-06-30')::DATE
      WHEN 3 THEN (k.ano || '-09-30')::DATE
      WHEN 4 THEN (k.ano || '-12-31')::DATE
    END as fim_trimestre
  ) datas
  LEFT JOIN public.contahub_periodo cp ON 
    cp.bar_id = k.bar_id
    AND cp.dt_gerencial >= (datas.fim_trimestre - INTERVAL '90 days')
    AND cp.dt_gerencial <= LEAST(datas.fim_trimestre, CURRENT_DATE)
    AND cp.cli_fone IS NOT NULL
    AND LENGTH(cp.cli_fone) >= 8
  WHERE cp.cli_fone IN (
    SELECT cli_fone
    FROM public.contahub_periodo
    WHERE bar_id = k.bar_id
      AND dt_gerencial >= (datas.fim_trimestre - INTERVAL '90 days')
      AND dt_gerencial <= LEAST(datas.fim_trimestre, CURRENT_DATE)
      AND cli_fone IS NOT NULL
      AND LENGTH(cli_fone) >= 8
    GROUP BY cli_fone
    HAVING COUNT(*) >= 2
  )
  GROUP BY 1,2,3
),
fat_contahub AS (
  SELECT bar_id,
         extract(year from dt_gerencial)::int as ano,
         ((extract(month from dt_gerencial)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(liquido, 0))::numeric as faturamento_contahub
  FROM public.contahub_pagamentos
  WHERE dt_gerencial >= '2024-01-01'
  GROUP BY 1,2,3
),
fat_yuzer AS (
  SELECT bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(valor_liquido, 0))::numeric as faturamento_yuzer
  FROM public.yuzer_pagamento
  WHERE data_evento >= '2024-01-01'
  GROUP BY 1,2,3
),
cmo AS (
  SELECT bar_id,
         extract(year from data_competencia)::int as ano,
         ((extract(month from data_competencia)::int - 1) / 3 + 1)::int as trimestre,
         sum(coalesce(valor, 0))::numeric as cmo_total
  FROM public.nibo_agendamentos
  WHERE categoria_nome IN (
    'SALARIO FUNCIONARIOS','ALIMENTAÇÃO','PROVISÃO TRABALHISTA','VALE TRANSPORTE',
    'FREELA ATENDIMENTO','FREELA BAR','FREELA COZINHA','FREELA LIMPEZA','FREELA SEGURANÇA',
    'Marketing','MANUTENÇÃO','Materiais Operação','Outros Operação'
  )
  AND data_competencia >= '2024-01-01'
  GROUP BY 1,2,3
),
artistica AS (
  SELECT bar_id,
         extract(year from data_evento)::int as ano,
         ((extract(month from data_evento)::int - 1) / 3 + 1)::int as trimestre,
         avg(coalesce(percent_art_fat, 0))::numeric as artistica_percent
  FROM public.view_eventos
  WHERE data_evento >= '2024-01-01'
  GROUP BY 1,2,3
)
SELECT
  k.bar_id,
  k.ano,
  k.trimestre,
  COALESCE(cu.clientes_totais, 0) as clientes_totais,
  COALESCE(ba.base_ativa_90d, 0) as base_ativa_90d,
  coalesce(c.cmo_total, 0) as cmo_total,
  (coalesce(fc.faturamento_contahub, 0) + coalesce(fy.faturamento_yuzer, 0))::numeric as faturamento_trimestre,
  case when (coalesce(fc.faturamento_contahub, 0) + coalesce(fy.faturamento_yuzer, 0)) > 0
       then (coalesce(c.cmo_total, 0) / (coalesce(fc.faturamento_contahub, 0) + coalesce(fy.faturamento_yuzer, 0))) * 100
       else 0 end::numeric as cmo_percent,
  coalesce(a.artistica_percent, 0) as artistica_percent
FROM keys k
LEFT JOIN clientes_unicos cu ON cu.bar_id = k.bar_id AND cu.ano = k.ano AND cu.trimestre = k.trimestre
LEFT JOIN base_ativa ba ON ba.bar_id = k.bar_id AND ba.ano = k.ano AND ba.trimestre = k.trimestre
LEFT JOIN fat_contahub fc ON fc.bar_id = k.bar_id AND fc.ano = k.ano AND fc.trimestre = k.trimestre
LEFT JOIN fat_yuzer fy ON fy.bar_id = k.bar_id AND fy.ano = k.ano AND fy.trimestre = k.trimestre
LEFT JOIN cmo c ON c.bar_id = k.bar_id AND c.ano = k.ano AND c.trimestre = k.trimestre
LEFT JOIN artistica a ON a.bar_id = k.bar_id AND a.ano = k.ano AND a.trimestre = k.trimestre;

CREATE UNIQUE INDEX IF NOT EXISTS idx_view_visao_geral_trimestral
  ON public.view_visao_geral_trimestral (bar_id, ano, trimestre);

GRANT SELECT ON TABLE public.view_visao_geral_trimestral TO anon, authenticated;

-- PASSO 2: Atualizar função RPC
-- ============================================================

CREATE OR REPLACE FUNCTION calcular_visao_geral_trimestral(
  p_bar_id INT,
  p_trimestre INT,
  p_ano INT
)
RETURNS TABLE (
  clientes_totais NUMERIC,
  clientes_ativos NUMERIC,
  variacao_clientes_totais NUMERIC,
  variacao_clientes_ativos NUMERIC,
  cmo_total NUMERIC,
  cmo_percentual NUMERIC,
  variacao_cmo NUMERIC,
  faturamento_trimestre NUMERIC,
  artistica_percentual NUMERIC,
  variacao_artistica NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trimestre_anterior INT;
  v_ano_anterior INT;
BEGIN
  IF p_trimestre = 1 THEN
    v_trimestre_anterior := 4;
    v_ano_anterior := p_ano - 1;
  ELSE
    v_trimestre_anterior := p_trimestre - 1;
    v_ano_anterior := p_ano;
  END IF;

  RETURN QUERY
  WITH atual AS (
    SELECT 
      v.clientes_totais,
      v.base_ativa_90d,
      v.cmo_total,
      v.cmo_percent,
      v.faturamento_trimestre,
      v.artistica_percent
    FROM public.view_visao_geral_trimestral v
    WHERE v.bar_id = p_bar_id
      AND v.ano = p_ano
      AND v.trimestre = p_trimestre
  ),
  anterior AS (
    SELECT 
      v.clientes_totais,
      v.base_ativa_90d,
      v.cmo_total,
      v.cmo_percent,
      v.faturamento_trimestre,
      v.artistica_percent
    FROM public.view_visao_geral_trimestral v
    WHERE v.bar_id = p_bar_id
      AND v.ano = v_ano_anterior
      AND v.trimestre = v_trimestre_anterior
  )
  SELECT 
    COALESCE(atual.clientes_totais, 0) AS clientes_totais,
    COALESCE(atual.base_ativa_90d, 0) AS clientes_ativos,
    CASE 
      WHEN COALESCE(anterior.clientes_totais, 0) > 0 
      THEN ((COALESCE(atual.clientes_totais, 0) - COALESCE(anterior.clientes_totais, 0)) / COALESCE(anterior.clientes_totais, 1)) * 100
      ELSE 0 
    END AS variacao_clientes_totais,
    CASE 
      WHEN COALESCE(anterior.base_ativa_90d, 0) > 0 
      THEN ((COALESCE(atual.base_ativa_90d, 0) - COALESCE(anterior.base_ativa_90d, 0)) / COALESCE(anterior.base_ativa_90d, 1)) * 100
      ELSE 0 
    END AS variacao_clientes_ativos,
    COALESCE(atual.cmo_total, 0) AS cmo_total,
    COALESCE(atual.cmo_percent, 0) AS cmo_percentual,
    CASE 
      WHEN COALESCE(anterior.cmo_percent, 0) > 0 
      THEN ((COALESCE(atual.cmo_percent, 0) - COALESCE(anterior.cmo_percent, 0)) / COALESCE(anterior.cmo_percent, 1)) * 100
      ELSE 0 
    END AS variacao_cmo,
    COALESCE(atual.faturamento_trimestre, 0) AS faturamento_trimestre,
    COALESCE(atual.artistica_percent, 0) AS artistica_percentual,
    CASE 
      WHEN COALESCE(anterior.artistica_percent, 0) > 0 
      THEN ((COALESCE(atual.artistica_percent, 0) - COALESCE(anterior.artistica_percent, 0)) / COALESCE(anterior.artistica_percent, 1)) * 100
      ELSE 0 
    END AS variacao_artistica
  FROM atual
  LEFT JOIN anterior ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION calcular_visao_geral_trimestral(INT, INT, INT) TO anon, authenticated;

-- PASSO 3: Configurar cron job para atualização automática
-- ============================================================

-- Remover jobs antigos se existirem (ignora erro se não existir)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh_view_visao_geral_trimestral');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh_view_visao_geral_anual');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Criar novos jobs: atualiza diariamente às 3h da manhã
SELECT cron.schedule(
  'refresh_view_visao_geral_trimestral',
  '0 3 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.view_visao_geral_trimestral$$
);

SELECT cron.schedule(
  'refresh_view_visao_geral_anual',
  '0 3 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.view_visao_geral_anual$$
);

-- PASSO 4: Verificar resultado
-- ============================================================

-- Verificar jobs criados
SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname LIKE 'refresh_view_visao_geral%';

-- Verificar dados da view
SELECT bar_id, ano, trimestre, clientes_totais, base_ativa_90d 
FROM public.view_visao_geral_trimestral 
WHERE bar_id = 3 AND ano = 2026 
ORDER BY trimestre;

-- Testar função RPC
SELECT * FROM calcular_visao_geral_trimestral(3, 1, 2026);
