import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

const sql = `
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
`;

async function executeSql() {
  try {
    console.log('Executando SQL...');
    
    // Executar o SQL usando a API REST do Supabase
    const response = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer {supabaseKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erro na resposta:', error);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ SQL executado com sucesso!');
    console.log('Resultado:', result);
    
  } catch (err) {
    console.error('❌ Erro ao executar SQL:', err);
    process.exit(1);
  }
}

executeSql();
