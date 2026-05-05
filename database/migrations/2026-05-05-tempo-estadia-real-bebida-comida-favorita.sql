-- 2026-05-05: tempo de estadia REAL + bebida/comida favorita por cliente
--
-- Problema 1 (tempo estadia):
-- silver.cliente_visitas.tempo_estadia_minutos era calculado via
-- bronze.bronze_contahub_produtos_temposproducao (tempos de PRODUCAO de itens),
-- nao a estadia real do cliente. Subestimava em ate 6h44 — ex: Nason 03/05
-- ficou 8h27 mas calc mostrava 1h43, porque so contava do primeiro pedido
-- ate o ultimo pagamento, ignorando o tempo de chegada antes do primeiro pedido.
--
-- Fix 1: extrair vd_hrabertura/vd_hrsaida do raw_json data_type='vendas'
-- (campos do PDV — autoritativos), persistir em bronze.vendasperiodo,
-- atualizar etl_silver_cliente_visitas_dia pra priorizar esses campos.
--
-- Resultado: cobertura 76% -> 92%, media 92min -> 178min (real).
--
-- Problema 2 (bebida/comida favorita):
-- silver.cliente_estatisticas tinha produtos_favoritos (jsonb top 10) mas
-- nao distinguia bebida de comida. Pra acoes de marketing (campanha por
-- produto preferido), faltava extrair top 1 de cada categoria.
--
-- Fix 2: 2 colunas novas (bebida_favorita, comida_favorita) populadas via
-- classificacao por regex da categoria. Cron diario propaga.

-- ==========================================================
-- 1. Bronze.vendasperiodo: 3 colunas pra horarios reais do PDV
-- ==========================================================
ALTER TABLE bronze.bronze_contahub_avendas_vendasperiodo
  ADD COLUMN IF NOT EXISTS vd_hrabertura timestamp,
  ADD COLUMN IF NOT EXISTS vd_hrsaida timestamp,
  ADD COLUMN IF NOT EXISTS vd_hrfechamento timestamp;

-- ==========================================================
-- 2. Funcao que extrai do raw_json e atualiza vendasperiodo
-- ==========================================================
CREATE OR REPLACE FUNCTION public.silver_atualizar_horarios_vendas_periodo(p_bar_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, bronze, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH horarios AS (
    SELECT
      rd.bar_id,
      (item->>'vd')::integer AS vd,
      rd.data_date,
      NULLIF(SUBSTRING(item->>'vd_hrabertura' FROM 1 FOR 19), '')::timestamp AS hr_abertura,
      NULLIF(SUBSTRING(item->>'vd_hrsaida' FROM 1 FOR 19), '')::timestamp AS hr_saida,
      NULLIF(SUBSTRING(item->>'vd_hrfechamento' FROM 1 FOR 19), '')::timestamp AS hr_fechamento
    FROM bronze.bronze_contahub_raw_data rd,
         jsonb_array_elements(rd.raw_json->'list') item
    WHERE rd.data_type = 'vendas'
      AND rd.raw_json IS NOT NULL
      AND (p_bar_id IS NULL OR rd.bar_id = p_bar_id)
      AND item->>'vd' IS NOT NULL
      AND item->>'vd_hrabertura' IS NOT NULL
  )
  UPDATE bronze.bronze_contahub_avendas_vendasperiodo vp SET
    vd_hrabertura   = h.hr_abertura,
    vd_hrsaida      = h.hr_saida,
    vd_hrfechamento = h.hr_fechamento
  FROM horarios h
  WHERE vp.bar_id = h.bar_id
    AND vp.vd::integer = h.vd
    AND vp.vd_dtgerencial = h.data_date
    AND (vp.vd_hrabertura IS NULL OR vp.vd_hrabertura != h.hr_abertura);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.silver_atualizar_horarios_vendas_periodo(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.silver_atualizar_horarios_vendas_periodo(integer) TO authenticated, service_role;

-- ==========================================================
-- 3. Atualizar etl_silver_cliente_visitas_dia pra priorizar vd_hrabertura/saida
-- ==========================================================
DO $patch$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.etl_silver_cliente_visitas_dia'::regproc);

  v_old := E'estadia_real AS (\n    SELECT vp.bar_id, vp.vd::int AS vd, vp.trn::int AS trn,\n      MIN((tp.t0_lancamento AT TIME ZONE ''America/Sao_Paulo'')) AS abertura,\n      MAX((COALESCE(tp.t3_entrega, tp.t2_prodfim, tp.t0_lancamento) AT TIME ZONE ''America/Sao_Paulo'')) AS fechamento\n    FROM bronze.bronze_contahub_avendas_vendasperiodo vp\n    JOIN bronze.bronze_contahub_produtos_temposproducao tp\n      ON tp.bar_id = vp.bar_id AND tp.dia = vp.vd_dtgerencial AND tp.vd_mesadesc = vp.vd_mesadesc\n    WHERE vp.bar_id = p_bar_id AND vp.vd_dtgerencial = p_data\n      AND tp.t0_lancamento IS NOT NULL AND vp.vd_mesadesc IS NOT NULL\n      AND NOT EXISTS (\n        SELECT 1 FROM bronze.bronze_contahub_avendas_vendasperiodo vp2\n        WHERE vp2.bar_id = vp.bar_id AND vp2.vd_dtgerencial = vp.vd_dtgerencial\n          AND vp2.vd_mesadesc = vp.vd_mesadesc AND vp2.vd <> vp.vd\n      )\n    GROUP BY vp.bar_id, vp.vd::int, vp.trn::int\n  )';

  v_new := E'estadia_real AS (\n    -- v3 2026-05-05: prioriza vd_hrabertura/vd_hrsaida do PDV (autoritativo).\n    -- Fallback pra calculo via tempos_producao quando ausente.\n    SELECT vp.bar_id, vp.vd::int AS vd, vp.trn::int AS trn,\n      COALESCE(\n        (vp.vd_hrabertura::text || ''-03:00'')::timestamptz,\n        MIN(tp.t0_lancamento AT TIME ZONE ''America/Sao_Paulo'')\n      ) AS abertura,\n      COALESCE(\n        (vp.vd_hrsaida::text || ''-03:00'')::timestamptz,\n        MAX(COALESCE(tp.t3_entrega, tp.t2_prodfim, tp.t0_lancamento) AT TIME ZONE ''America/Sao_Paulo'')\n      ) AS fechamento\n    FROM bronze.bronze_contahub_avendas_vendasperiodo vp\n    LEFT JOIN bronze.bronze_contahub_produtos_temposproducao tp\n      ON tp.bar_id = vp.bar_id AND tp.dia = vp.vd_dtgerencial AND tp.vd_mesadesc = vp.vd_mesadesc\n      AND tp.t0_lancamento IS NOT NULL\n    WHERE vp.bar_id = p_bar_id AND vp.vd_dtgerencial = p_data\n      AND vp.vd_mesadesc IS NOT NULL\n      AND NOT EXISTS (\n        SELECT 1 FROM bronze.bronze_contahub_avendas_vendasperiodo vp2\n        WHERE vp2.bar_id = vp.bar_id AND vp2.vd_dtgerencial = vp.vd_dtgerencial\n          AND vp2.vd_mesadesc = vp.vd_mesadesc AND vp2.vd <> vp.vd\n      )\n    GROUP BY vp.bar_id, vp.vd::int, vp.trn::int, vp.vd_hrabertura, vp.vd_hrsaida\n  )';

  IF position(v_old IN v_def) > 0 THEN
    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
  END IF;
END $patch$;

-- ==========================================================
-- 4. Atualizar view public.visitas (priorizar vd_hrabertura/vd_hrsaida)
-- ==========================================================
CREATE OR REPLACE VIEW public.visitas AS
WITH estadia_por_venda AS (
  SELECT bar_id, dt_gerencial, vd::integer AS vd, trn::integer AS trn,
    min(hr_lancamento::timestamp) AS abertura,
    max(hr_transacao::timestamp) AS fechamento
  FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
  WHERE hr_lancamento IS NOT NULL
  GROUP BY bar_id, dt_gerencial, vd, trn
)
SELECT v.id,
  v.bar_id,
  v.vd_dtgerencial AS data_visita,
  v.cli_fone AS cliente_fone,
  v.cli_nome AS cliente_nome,
  v.vd_vrpagamentos AS valor_pagamentos,
  v.vd_vrcouvert AS valor_couvert,
  v.vd_vrprodutos AS valor_produtos,
  v.vd_vrdescontos AS valor_desconto,
  v.vd_vrrepique AS valor_repique,
  v.vd_motivodesconto AS motivo_desconto,
  v.vd_pessoas AS pessoas,
  v.vd_mesadesc AS mesa_desc,
  v.tipovenda AS tipo_venda,
  v.vd_localizacao AS localizacao,
  COALESCE(v.vd_hrabertura, e.abertura) AS hora_abertura,
  CASE
    WHEN v.vd_hrabertura IS NOT NULL AND v.vd_hrsaida IS NOT NULL AND v.vd_hrsaida > v.vd_hrabertura
      THEN (EXTRACT(epoch FROM v.vd_hrsaida - v.vd_hrabertura) / 60::numeric)::integer
    WHEN e.abertura IS NOT NULL AND e.fechamento IS NOT NULL AND e.fechamento > e.abertura
      THEN (EXTRACT(epoch FROM e.fechamento - e.abertura) / 60::numeric)::integer
    ELSE NULL::integer
  END AS tempo_estadia_minutos,
  COALESCE(v.vd_vrpagamentos, 0::numeric) - COALESCE(v.vd_vrcouvert, 0::numeric) AS valor_consumo,
  ce.cliente_email,
  ce.cliente_dtnasc,
  normalizar_telefone_br(v.cli_fone) AS cliente_fone_norm
FROM bronze.bronze_contahub_avendas_vendasperiodo v
LEFT JOIN estadia_por_venda e
  ON e.bar_id = v.bar_id AND e.dt_gerencial = v.vd_dtgerencial AND e.vd = v.vd AND e.trn = v.trn
LEFT JOIN silver.cliente_estatisticas ce
  ON ce.bar_id = v.bar_id AND ce.cliente_fone_norm = normalizar_telefone_br(v.cli_fone);

-- ==========================================================
-- 5. Bebida/comida favorita: 2 colunas + funcao + cron
-- ==========================================================
ALTER TABLE silver.cliente_estatisticas
  ADD COLUMN IF NOT EXISTS bebida_favorita jsonb,
  ADD COLUMN IF NOT EXISTS comida_favorita jsonb;

CREATE OR REPLACE FUNCTION public.silver_atualizar_bebida_comida_favorita(p_bar_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, silver, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH ranked AS (
    SELECT
      ce.bar_id, ce.cliente_fone_norm,
      p->>'produto' AS produto,
      p->>'categoria' AS categoria,
      (p->>'quantidade')::numeric AS qtd,
      COALESCE((p->>'vezes_pediu')::integer, 0) AS vezes_pediu,
      CASE
        WHEN p->>'categoria' ~* '(cerveja|bebida|drink|dose|vinho|baldinho|balde|happy hour|espresso|garrafa|moscow|chopp)' THEN 'BEBIDA'
        WHEN p->>'categoria' ~* '(prato|sanduich|sobremesa|combo|pizza|burger|hamburg|tira-?gosto|porção|porcao|petisco|salad)' THEN 'COMIDA'
        ELSE 'OUTRO'
      END AS classe
    FROM silver.cliente_estatisticas ce,
         jsonb_array_elements(ce.produtos_favoritos) p
    WHERE (p_bar_id IS NULL OR ce.bar_id = p_bar_id)
      AND ce.produtos_favoritos IS NOT NULL
      AND jsonb_array_length(ce.produtos_favoritos) > 0
  ),
  top_bebida AS (
    SELECT DISTINCT ON (bar_id, cliente_fone_norm)
      bar_id, cliente_fone_norm,
      jsonb_build_object('produto', produto, 'categoria', categoria, 'quantidade', qtd, 'vezes_pediu', vezes_pediu) AS obj
    FROM ranked WHERE classe='BEBIDA'
    ORDER BY bar_id, cliente_fone_norm, qtd DESC, vezes_pediu DESC
  ),
  top_comida AS (
    SELECT DISTINCT ON (bar_id, cliente_fone_norm)
      bar_id, cliente_fone_norm,
      jsonb_build_object('produto', produto, 'categoria', categoria, 'quantidade', qtd, 'vezes_pediu', vezes_pediu) AS obj
    FROM ranked WHERE classe='COMIDA'
    ORDER BY bar_id, cliente_fone_norm, qtd DESC, vezes_pediu DESC
  )
  UPDATE silver.cliente_estatisticas ce SET
    bebida_favorita = tb.obj,
    comida_favorita = tc.obj
  FROM top_bebida tb
  FULL OUTER JOIN top_comida tc
    ON tc.bar_id = tb.bar_id AND tc.cliente_fone_norm = tb.cliente_fone_norm
  WHERE ce.bar_id = COALESCE(tb.bar_id, tc.bar_id)
    AND ce.cliente_fone_norm = COALESCE(tb.cliente_fone_norm, tc.cliente_fone_norm);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.silver_atualizar_bebida_comida_favorita(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.silver_atualizar_bebida_comida_favorita(integer) TO authenticated, service_role;

-- ==========================================================
-- 6. Atualizar crons pra rodar as novas funcoes
-- ==========================================================
SELECT cron.alter_job(
  job_id := 294,  -- contahub-update-eventos-ambos
  command := 'SELECT update_eventos_ambos_bares(); SELECT public.silver_atualizar_horarios_vendas_periodo();'
);

SELECT cron.alter_job(
  job_id := 447,  -- silver-cliente-estatisticas-diario
  command := 'SELECT public.etl_silver_cliente_estatisticas_all_bars(); SELECT public.silver_atualizar_cadastro_clientes_contahub(); SELECT public.silver_atualizar_bebida_comida_favorita();'
);

-- Backfill imediato (rodar uma vez)
SELECT public.silver_atualizar_horarios_vendas_periodo();
SELECT public.silver_atualizar_bebida_comida_favorita();
