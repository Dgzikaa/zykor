-- View Materializada: view_visao_geral_anual
-- MIGRADO: faturamento_pagamentos, visitas (domain tables)
CREATE MATERIALIZED VIEW view_visao_geral_anual AS
WITH keys AS (
  SELECT DISTINCT faturamento_pagamentos.bar_id,
    EXTRACT(year FROM faturamento_pagamentos.data_pagamento)::integer AS ano
  FROM faturamento_pagamentos
  UNION
  SELECT DISTINCT visitas.bar_id,
    EXTRACT(year FROM visitas.data_visita)::integer AS ano
  FROM visitas
  UNION
  SELECT DISTINCT yuzer_pagamento.bar_id,
    EXTRACT(year FROM yuzer_pagamento.data_evento)::integer AS ano
  FROM yuzer_pagamento
  UNION
  SELECT DISTINCT yuzer_produtos.bar_id,
    EXTRACT(year FROM yuzer_produtos.data_evento)::integer AS ano
  FROM yuzer_produtos
  UNION
  SELECT DISTINCT sympla_participantes.bar_id,
    EXTRACT(year FROM sympla_participantes.data_checkin)::integer AS ano
  FROM sympla_participantes
),
fat_pagamentos AS (
  SELECT faturamento_pagamentos.bar_id,
    EXTRACT(year FROM faturamento_pagamentos.data_pagamento)::integer AS ano,
    sum(COALESCE(faturamento_pagamentos.valor_liquido, 0::numeric)) AS faturamento_contahub
  FROM faturamento_pagamentos
  GROUP BY faturamento_pagamentos.bar_id, (EXTRACT(year FROM faturamento_pagamentos.data_pagamento)::integer)
),
fat_yuzer AS (
  SELECT yuzer_pagamento.bar_id,
    EXTRACT(year FROM yuzer_pagamento.data_evento)::integer AS ano,
    sum(COALESCE(yuzer_pagamento.valor_liquido, 0::numeric)) AS faturamento_yuzer
  FROM yuzer_pagamento
  GROUP BY yuzer_pagamento.bar_id, (EXTRACT(year FROM yuzer_pagamento.data_evento)::integer)
),
pessoas_visitas AS (
  SELECT visitas.bar_id,
    EXTRACT(year FROM visitas.data_visita)::integer AS ano,
    sum(COALESCE(visitas.pessoas, 0::numeric)) AS pessoas_contahub
  FROM visitas
  GROUP BY visitas.bar_id, (EXTRACT(year FROM visitas.data_visita)::integer)
),
pessoas_yuzer AS (
  SELECT yuzer_produtos.bar_id,
    EXTRACT(year FROM yuzer_produtos.data_evento)::integer AS ano,
    sum(COALESCE(yuzer_produtos.quantidade, 0)) FILTER (WHERE lower(COALESCE(yuzer_produtos.produto_nome, ''::text)) ~~ '%ingresso%'::text OR lower(COALESCE(yuzer_produtos.produto_nome, ''::text)) ~~ '%entrada%'::text)::numeric AS pessoas_yuzer
  FROM yuzer_produtos
  GROUP BY yuzer_produtos.bar_id, (EXTRACT(year FROM yuzer_produtos.data_evento)::integer)
),
pessoas_sympla AS (
  SELECT sympla_participantes.bar_id,
    EXTRACT(year FROM sympla_participantes.data_checkin)::integer AS ano,
    count(*) FILTER (WHERE COALESCE(sympla_participantes.fez_checkin, false) = true)::numeric AS pessoas_sympla
  FROM sympla_participantes
  GROUP BY sympla_participantes.bar_id, (EXTRACT(year FROM sympla_participantes.data_checkin)::integer)
),
reputacao AS (
  SELECT EXTRACT(year FROM google_reviews.published_at_date)::integer AS ano,
    avg(google_reviews.stars) FILTER (WHERE google_reviews.stars IS NOT NULL AND google_reviews.stars > 0) AS reputacao_media
  FROM google_reviews
  GROUP BY (EXTRACT(year FROM google_reviews.published_at_date)::integer)
)
SELECT k.bar_id, k.ano,
  COALESCE(fc.faturamento_contahub, 0::numeric) AS faturamento_contahub,
  COALESCE(fy.faturamento_yuzer, 0::numeric) AS faturamento_yuzer,
  0::numeric AS faturamento_sympla,
  COALESCE(fc.faturamento_contahub, 0::numeric) + COALESCE(fy.faturamento_yuzer, 0::numeric) AS faturamento_total,
  COALESCE(pv.pessoas_contahub, 0::numeric) AS pessoas_contahub,
  COALESCE(py.pessoas_yuzer, 0::numeric) AS pessoas_yuzer,
  COALESCE(ps.pessoas_sympla, 0::numeric) AS pessoas_sympla,
  COALESCE(pv.pessoas_contahub, 0::numeric) + COALESCE(py.pessoas_yuzer, 0::numeric) + COALESCE(ps.pessoas_sympla, 0::numeric) AS pessoas_total,
  COALESCE(r.reputacao_media, 0::numeric) AS reputacao_media
FROM keys k
  LEFT JOIN fat_pagamentos fc ON fc.bar_id = k.bar_id AND fc.ano = k.ano
  LEFT JOIN fat_yuzer fy ON fy.bar_id = k.bar_id AND fy.ano = k.ano
  LEFT JOIN pessoas_visitas pv ON pv.bar_id = k.bar_id AND pv.ano = k.ano
  LEFT JOIN pessoas_yuzer py ON py.bar_id = k.bar_id AND py.ano = k.ano
  LEFT JOIN pessoas_sympla ps ON ps.bar_id = k.bar_id AND ps.ano = k.ano
  LEFT JOIN reputacao r ON r.ano = k.ano;