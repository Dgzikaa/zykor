CREATE MATERIALIZED VIEW view_visao_geral_trimestral AS
WITH keys AS (
  SELECT DISTINCT visitas.bar_id,
    EXTRACT(year FROM visitas.data_visita)::integer AS ano,
    (EXTRACT(month FROM visitas.data_visita)::integer - 1) / 3 + 1 AS trimestre
  FROM visitas
  WHERE visitas.data_visita >= '2024-01-01'::date
),
clientes_unicos AS (
  SELECT visitas.bar_id,
    EXTRACT(year FROM visitas.data_visita)::integer AS ano,
    (EXTRACT(month FROM visitas.data_visita)::integer - 1) / 3 + 1 AS trimestre,
    count(DISTINCT visitas.cliente_fone)::numeric AS clientes_totais
  FROM visitas
  WHERE visitas.cliente_fone IS NOT NULL AND length(visitas.cliente_fone) >= 8 AND visitas.data_visita >= '2024-01-01'::date
  GROUP BY visitas.bar_id, (EXTRACT(year FROM visitas.data_visita)::integer), ((EXTRACT(month FROM visitas.data_visita)::integer - 1) / 3 + 1)
),
base_ativa AS (
  SELECT k_1.bar_id, k_1.ano, k_1.trimestre,
    (( SELECT count(*) AS count
        FROM ( SELECT cp.cliente_fone
                FROM visitas cp
                WHERE cp.bar_id = k_1.bar_id AND cp.data_visita >= (LEAST(
                      CASE k_1.trimestre
                          WHEN 1 THEN (k_1.ano || '-03-31')::date
                          WHEN 2 THEN (k_1.ano || '-06-30')::date
                          WHEN 3 THEN (k_1.ano || '-09-30')::date
                          WHEN 4 THEN (k_1.ano || '-12-31')::date
                          ELSE NULL::date
                      END, CURRENT_DATE) - '90 days'::interval) AND cp.data_visita <= LEAST(
                      CASE k_1.trimestre
                          WHEN 1 THEN (k_1.ano || '-03-31')::date
                          WHEN 2 THEN (k_1.ano || '-06-30')::date
                          WHEN 3 THEN (k_1.ano || '-09-30')::date
                          WHEN 4 THEN (k_1.ano || '-12-31')::date
                          ELSE NULL::date
                      END, CURRENT_DATE) AND cp.cliente_fone IS NOT NULL AND length(cp.cliente_fone) >= 8
                GROUP BY cp.cliente_fone
                HAVING count(DISTINCT cp.data_visita) >= 2) subq))::numeric AS base_ativa_90d
  FROM keys k_1
),
fat_pagamentos AS (
  SELECT faturamento_pagamentos.bar_id,
    EXTRACT(year FROM faturamento_pagamentos.data_pagamento)::integer AS ano,
    (EXTRACT(month FROM faturamento_pagamentos.data_pagamento)::integer - 1) / 3 + 1 AS trimestre,
    sum(COALESCE(faturamento_pagamentos.valor_liquido, 0::numeric)) AS faturamento_contahub
  FROM faturamento_pagamentos
  WHERE faturamento_pagamentos.data_pagamento >= '2024-01-01'::date
  GROUP BY faturamento_pagamentos.bar_id, (EXTRACT(year FROM faturamento_pagamentos.data_pagamento)::integer), ((EXTRACT(month FROM faturamento_pagamentos.data_pagamento)::integer - 1) / 3 + 1)
),
fat_yuzer AS (
  SELECT yuzer_pagamento.bar_id,
    EXTRACT(year FROM yuzer_pagamento.data_evento)::integer AS ano,
    (EXTRACT(month FROM yuzer_pagamento.data_evento)::integer - 1) / 3 + 1 AS trimestre,
    sum(COALESCE(yuzer_pagamento.valor_liquido, 0::numeric)) AS faturamento_yuzer
  FROM yuzer_pagamento
  WHERE yuzer_pagamento.data_evento >= '2024-01-01'::date
  GROUP BY yuzer_pagamento.bar_id, (EXTRACT(year FROM yuzer_pagamento.data_evento)::integer), ((EXTRACT(month FROM yuzer_pagamento.data_evento)::integer - 1) / 3 + 1)
),
cmo AS (
  SELECT nibo_agendamentos.bar_id,
    EXTRACT(year FROM nibo_agendamentos.data_competencia)::integer AS ano,
    (EXTRACT(month FROM nibo_agendamentos.data_competencia)::integer - 1) / 3 + 1 AS trimestre,
    sum(COALESCE(nibo_agendamentos.valor, 0::numeric)) AS cmo_total
  FROM nibo_agendamentos
  WHERE (nibo_agendamentos.categoria_nome::text = ANY (ARRAY['SALARIO FUNCIONARIOS', 'ALIMENTACAO', 'PROVISAO TRABALHISTA', 'VALE TRANSPORTE', 'FREELA ATENDIMENTO', 'FREELA BAR', 'FREELA COZINHA', 'FREELA LIMPEZA', 'FREELA SEGURANCA', 'Marketing', 'MANUTENCAO', 'Materiais Operacao', 'Outros Operacao']::text[])) AND nibo_agendamentos.data_competencia >= '2024-01-01'::date
  GROUP BY nibo_agendamentos.bar_id, (EXTRACT(year FROM nibo_agendamentos.data_competencia)::integer), ((EXTRACT(month FROM nibo_agendamentos.data_competencia)::integer - 1) / 3 + 1)
),
artistica AS (
  SELECT view_eventos.bar_id,
    EXTRACT(year FROM view_eventos.data_evento)::integer AS ano,
    (EXTRACT(month FROM view_eventos.data_evento)::integer - 1) / 3 + 1 AS trimestre,
    avg(COALESCE(view_eventos.percent_art_fat, 0::numeric)) AS artistica_percent
  FROM view_eventos
  WHERE view_eventos.data_evento >= '2024-01-01'::date
  GROUP BY view_eventos.bar_id, (EXTRACT(year FROM view_eventos.data_evento)::integer), ((EXTRACT(month FROM view_eventos.data_evento)::integer - 1) / 3 + 1)
)
SELECT k.bar_id, k.ano, k.trimestre,
  COALESCE(cu.clientes_totais, 0::numeric) AS clientes_totais,
  COALESCE(ba.base_ativa_90d, 0::numeric) AS base_ativa_90d,
  COALESCE(c.cmo_total, 0::numeric) AS cmo_total,
  COALESCE(fc.faturamento_contahub, 0::numeric) + COALESCE(fy.faturamento_yuzer, 0::numeric) AS faturamento_trimestre,
      CASE
          WHEN (COALESCE(fc.faturamento_contahub, 0::numeric) + COALESCE(fy.faturamento_yuzer, 0::numeric)) > 0::numeric THEN COALESCE(c.cmo_total, 0::numeric) / (COALESCE(fc.faturamento_contahub, 0::numeric) + COALESCE(fy.faturamento_yuzer, 0::numeric)) * 100::numeric
          ELSE 0::numeric
      END AS cmo_percent,
  COALESCE(a.artistica_percent, 0::numeric) AS artistica_percent
FROM keys k
  LEFT JOIN clientes_unicos cu ON cu.bar_id = k.bar_id AND cu.ano = k.ano AND cu.trimestre = k.trimestre
  LEFT JOIN base_ativa ba ON ba.bar_id = k.bar_id AND ba.ano = k.ano AND ba.trimestre = k.trimestre
  LEFT JOIN fat_pagamentos fc ON fc.bar_id = k.bar_id AND fc.ano = k.ano AND fc.trimestre = k.trimestre
  LEFT JOIN fat_yuzer fy ON fy.bar_id = k.bar_id AND fy.ano = k.ano AND fy.trimestre = k.trimestre
  LEFT JOIN cmo c ON c.bar_id = k.bar_id AND c.ano = k.ano AND c.trimestre = k.trimestre
  LEFT JOIN artistica a ON a.bar_id = k.bar_id AND a.ano = k.ano AND a.trimestre = k.trimestre;