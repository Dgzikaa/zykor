-- NPS por ÁREA e por DATA DA VISITA — pedido do Cadu (04/08/2026):
--   "tem como add o NPS por área? ... conseguir segmentar os feedbacks por data de visita.
--    no Falae tem o horário que a pessoa respondeu, mas pra ver o dia eu preciso entrar em cada
--    resposta. Sei que o tempo de entrega foi ruim, mas não sei o dia que isso rolou."
--
-- O dado já existia no bronze (o Falae manda uma nota 1-5 por área dentro de criterios[].type='Rating',
-- e a pergunta "Data da Visita"), mas as views existentes NÃO servem pra essa tela:
--   - silver.nps_criterio_evento  -> exige JOIN com operations.eventos_base (dia sem evento cadastrado
--                                    some da análise) e não traz comentário/cliente.
--   - silver.nps_comentarios      -> só respostas COM texto livre.
-- Aqui ficam as duas views "cruas" da tela de NPS: 1 linha por resposta e 1 linha por (resposta × área),
-- sem exigir evento e sem perder resposta.
--
-- REGRA CANÔNICA DO NPS (fechada em 31/07/2026, ver migration 2026-07-31-nps-inclui-pesquisa-legada):
-- NPS = respostas das pesquisas 'NPS' (digital atual), 'NPS Digital' (mesmo formulário até 29/03/2026)
-- e 'Salão' (presencial). Fidelidade e Aniversário NÃO são NPS.
--
-- A canonicalização dos rótulos de área ("TEMPO DE ENTREGA" / "Tempo de Espera" / "TEMPO DE ESPERA DOS
-- PEDIDOS" são a mesma coisa) fica no TS (lib/analytics/nps-dimensoes.ts), igual ao resto do módulo.

-- 1 linha por resposta de NPS.
CREATE OR REPLACE VIEW silver.v_nps_resposta AS
WITH base AS (
  SELECT
    r.bar_id,
    r.falae_id,
    r.search_name,
    r.nps,
    r.client_name,
    -- created_at é timestamptz; o dia do NPS é sempre no fuso de São Paulo.
    (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_resposta,
    -- Coluna dedicada quando o webhook já preencheu; senão extrai do formulário (rótulo antigo
    -- "Data do pedido" dobra a cobertura em respostas velhas).
    COALESCE(
      r.data_visita,
      (SELECT (c->>'name')::date
         FROM jsonb_array_elements(COALESCE(r.criterios, r.raw_data->'criteria')) c
        WHERE (lower(c->>'nick') LIKE '%data da visita%' OR lower(c->>'nick') LIKE '%data do pedido%')
          AND c->>'name' ~ '^\d{4}-\d{2}-\d{2}$'
        LIMIT 1)
    ) AS data_visita_bruta,
    NULLIF(btrim(r.discursive_question), '') AS comentario
  FROM bronze.bronze_falae_respostas r
  WHERE r.nps IS NOT NULL
    AND r.search_name IN ('NPS', 'NPS Digital', 'Salão')
)
SELECT
  b.bar_id,
  b.falae_id,
  b.search_name,
  b.nps,
  b.client_name AS cliente_nome,
  b.data_resposta,
  -- Guarda-corpo: a data é DIGITADA pelo cliente (tem typo e data futura). Fora da janela
  -- plausível vira NULL — a resposta continua na base, só não entra nos cortes por dia.
  CASE
    WHEN b.data_visita_bruta BETWEEN b.data_resposta - 60 AND b.data_resposta
    THEN b.data_visita_bruta
  END AS data_visita,
  CASE WHEN b.nps >= 9 THEN 'promotor' WHEN b.nps >= 7 THEN 'neutro' ELSE 'detrator' END AS categoria,
  b.comentario
FROM base b;

-- 1 linha por (resposta × área avaliada). Grão da análise "qual área caiu, e em que dia".
CREATE OR REPLACE VIEW silver.v_nps_area AS
SELECT
  v.bar_id,
  v.falae_id,
  v.data_visita,
  v.data_resposta,
  v.nps,
  v.categoria,
  btrim(c->>'nick') AS area_raw,
  NULLIF(regexp_replace(c->>'name', '\D', '', 'g'), '')::int AS nota
FROM silver.v_nps_resposta v
JOIN bronze.bronze_falae_respostas r
  ON r.bar_id = v.bar_id AND r.falae_id = v.falae_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.criterios, r.raw_data->'criteria')) c
WHERE jsonb_typeof(COALESCE(r.criterios, r.raw_data->'criteria')) = 'array'
  AND lower(c->>'type') = 'rating'
  AND NULLIF(regexp_replace(c->>'name', '\D', '', 'g'), '')::int BETWEEN 1 AND 5;

GRANT SELECT ON silver.v_nps_resposta TO service_role, authenticated;
GRANT SELECT ON silver.v_nps_area     TO service_role, authenticated;
