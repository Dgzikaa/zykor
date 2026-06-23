-- ============================================================================
-- ContaHub Notas Fiscais (qry=73) — pipeline medallion completo
-- ----------------------------------------------------------------------------
-- Relatório de Notas Fiscais do ContaHub (NFCe/NFe). A query qry=73 filtra por
-- nf_dtcontabil (data contábil/emissão da nota) no range d0..d1 — confirmado:
-- fetch de 1 dia retorna só linhas com nf_dtcontabil = aquele dia (vd_dtgerencial
-- pode ser D-1, venda após meia-noite).
--
-- Cada empresa ContaHub emite sob mais de um CNPJ; o relatório só devolve o
-- ÍNDICE do CNPJ (cnpj#: 1, 2, 3...), não o número. O rótulo real fica em
-- financial.nf_cnpj_labels (editável).
--
-- Camadas:
--   bronze.bronze_contahub_notas_fiscais  — uma linha por (cnpj, dia, tipo, série)
--   silver.contahub_notas_fiscais         — view tipada/renomeada (security invoker)
--   gold.notas_fiscais_diaria             — consolidação por dia x CNPJ (+ rótulo)
--
-- Ingestão: contahub-sync-automatico (data_type='notasfiscais') ->
--   bronze_contahub_raw_data -> processar_raw_data_pendente ->
--   process_notasfiscais_data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BRONZE — tabela tipada
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bronze.bronze_contahub_notas_fiscais (
  id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bar_id                      integer NOT NULL,
  cnpj_indice                 integer,                 -- "cnpj#" do ContaHub (1,2,3...)
  nf_dtcontabil               date NOT NULL,           -- data contábil/emissão (chave do dia)
  vd_dtgerencial              date,                    -- dia gerencial da venda (pode ser D-1)
  nf_tipo                     text,                    -- NFCe / NFe
  nf_ambiente                 text,                    -- 1=produção, 2=homologação
  nf_serie                    integer,
  subst_nfe_nfce              numeric,
  cancelada                   integer,                 -- qtd de notas canceladas
  autorizada                  integer,                 -- qtd de notas autorizadas
  inutilizada                 integer,
  valor_autorizado            numeric,                 -- total emitido (autorizado)
  valor_substituido_nfe_nfce  numeric,
  valor_a_apurar              numeric,
  vrst_autorizado             numeric,                 -- ST autorizado
  valor_cancelado             numeric,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- grão completo (rede de segurança contra duplicidade)
CREATE UNIQUE INDEX IF NOT EXISTS uq_bronze_contahub_nf_grao
  ON bronze.bronze_contahub_notas_fiscais
  (bar_id, cnpj_indice, nf_dtcontabil, vd_dtgerencial, nf_tipo, nf_serie, nf_ambiente);

CREATE INDEX IF NOT EXISTS ix_bronze_contahub_nf_bar_data
  ON bronze.bronze_contahub_notas_fiscais (bar_id, nf_dtcontabil);

COMMENT ON TABLE bronze.bronze_contahub_notas_fiscais IS
  'ContaHub qry=73 (Notas Fiscais). Uma linha por cnpj#/dia contábil/tipo/série. Ingestão via process_notasfiscais_data.';

-- ----------------------------------------------------------------------------
-- 2. BRONZE — processador (espelha process_sinteticoporhorario_data)
--    Advisory lock usa (epoch # 73) p/ não colidir com outros data_types.
--    Idempotente: DELETE por (bar_id, nf_dtcontabil) + INSERT.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_notasfiscais_data(
  p_bar_id integer, p_data_array jsonb, p_data_date date
) RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  item_json jsonb;
  inserted_count integer := 0;
  data_list jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(p_bar_id::integer, (EXTRACT(epoch FROM p_data_date)::integer # 73));

  data_list := CASE
    WHEN jsonb_typeof(p_data_array) = 'object' AND p_data_array ? 'list' THEN p_data_array->'list'
    ELSE p_data_array
  END;

  DELETE FROM bronze.bronze_contahub_notas_fiscais
  WHERE bar_id = p_bar_id AND nf_dtcontabil = p_data_date;

  FOR item_json IN SELECT jsonb_array_elements(data_list) LOOP
    INSERT INTO bronze.bronze_contahub_notas_fiscais (
      bar_id, cnpj_indice, nf_dtcontabil, vd_dtgerencial, nf_tipo, nf_ambiente,
      nf_serie, subst_nfe_nfce, cancelada, autorizada, inutilizada,
      valor_autorizado, valor_substituido_nfe_nfce, valor_a_apurar,
      vrst_autorizado, valor_cancelado
    ) VALUES (
      p_bar_id,
      NULLIF(item_json->>'cnpj#', '')::integer,
      COALESCE(NULLIF(LEFT(item_json->>'nf_dtcontabil', 10), '')::date, p_data_date),
      NULLIF(LEFT(item_json->>'vd_dtgerencial', 10), '')::date,
      item_json->>'nf_tipo',
      item_json->>'nf_ambiente',
      NULLIF(item_json->>'nf_serie', '')::integer,
      NULLIF(item_json->>'subst_nfe_nfce', '')::numeric,
      NULLIF(item_json->>'cancelada', '')::integer,
      NULLIF(item_json->>'autorizada', '')::integer,
      NULLIF(item_json->>'inutilizada', '')::integer,
      NULLIF(item_json->>'valor_autorizado', '')::numeric,
      NULLIF(item_json->>'valor_substituido_nfe_nfce', '')::numeric,
      NULLIF(item_json->>'valor_a_apurar', '')::numeric,
      NULLIF(item_json->>'vrst_autorizado', '')::numeric,
      NULLIF(item_json->>'valor_cancelado', '')::numeric
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 3. RÓTULOS DE CNPJ (editável) — o relatório só traz o índice
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial.nf_cnpj_labels (
  bar_id       integer NOT NULL,
  cnpj_indice  integer NOT NULL,
  label        text NOT NULL,
  documento    text,                 -- número do CNPJ (opcional)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bar_id, cnpj_indice)
);

COMMENT ON TABLE financial.nf_cnpj_labels IS
  'Rótulo amigável por índice de CNPJ do ContaHub (qry=73). Preenchido pelo usuário.';

-- seed dos índices conhecidos com os CNPJs reais.
-- NB: Deboche (bar 4) usa os índices 1 e 3 no ContaHub (não 1 e 2).
INSERT INTO financial.nf_cnpj_labels (bar_id, cnpj_indice, label, documento) VALUES
  (3, 1, 'ORDINARIO BAR E GASTRONOMIA LTDA', '57.960.083/0001-88'),
  (3, 2, 'ORDI BAR LTDA',                    '59.085.920/0001-00'),
  (4, 1, 'DESCUBRA BAR E RESTAURANTE LTDA',  '40.433.371/0001-81'),
  (4, 3, 'DSCBR BAR E RESTAURANTE LTDA',     '54.340.684/0001-08')
ON CONFLICT (bar_id, cnpj_indice) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. SILVER — view tipada (security invoker)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW silver.contahub_notas_fiscais
WITH (security_invoker = true) AS
SELECT
  b.bar_id,
  b.cnpj_indice,
  b.nf_dtcontabil,
  b.vd_dtgerencial,
  b.nf_tipo,
  b.nf_serie,
  b.nf_ambiente,
  b.autorizada                 AS qtd_autorizada,
  b.cancelada                  AS qtd_cancelada,
  b.inutilizada                AS qtd_inutilizada,
  b.valor_autorizado,
  b.valor_cancelado,
  b.valor_a_apurar,
  b.vrst_autorizado,
  b.valor_substituido_nfe_nfce,
  b.subst_nfe_nfce
FROM bronze.bronze_contahub_notas_fiscais b;

-- ----------------------------------------------------------------------------
-- 5. GOLD — consolidação diária por CNPJ (com rótulo)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW gold.notas_fiscais_diaria
WITH (security_invoker = true) AS
SELECT
  s.bar_id,
  s.nf_dtcontabil                                   AS data,
  s.cnpj_indice,
  COALESCE(l.label, 'CNPJ ' || s.cnpj_indice)       AS cnpj_label,
  l.documento                                       AS cnpj_documento,
  SUM(s.valor_autorizado)                           AS total_autorizado,
  SUM(s.valor_cancelado)                            AS total_cancelado,
  SUM(s.valor_a_apurar)                             AS total_a_apurar,
  SUM(s.vrst_autorizado)                            AS total_st_autorizado,
  SUM(COALESCE(s.qtd_autorizada, 0))                AS qtd_notas,
  SUM(COALESCE(s.qtd_cancelada, 0))                 AS qtd_canceladas
FROM silver.contahub_notas_fiscais s
LEFT JOIN financial.nf_cnpj_labels l
  ON l.bar_id = s.bar_id AND l.cnpj_indice = s.cnpj_indice
GROUP BY s.bar_id, s.nf_dtcontabil, s.cnpj_indice, l.label, l.documento;

-- ----------------------------------------------------------------------------
-- 6. DISPATCHER — adiciona WHEN 'notasfiscais' em processar_raw_data_pendente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.processar_raw_data_pendente()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rec RECORD;
  v_result TEXT := '';
  v_count INTEGER := 0;
  v_data JSONB;
  v_datas_processadas DATE[] := ARRAY[]::DATE[];
  v_error_count INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT id, bar_id, data_date, data_type, raw_json
    FROM bronze.bronze_contahub_raw_data
    WHERE processed = false
      AND data_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY data_date, bar_id, data_type
  LOOP
    BEGIN
      v_data := CASE
        WHEN jsonb_typeof(rec.raw_json) = 'object' AND rec.raw_json ? 'list' THEN rec.raw_json->'list'
        WHEN jsonb_typeof(rec.raw_json) = 'array' THEN rec.raw_json
        ELSE '[]'::jsonb
      END;

      CASE rec.data_type
        WHEN 'analitico' THEN
          PERFORM public.process_analitico_data(rec.bar_id, v_data, rec.data_date);
          IF NOT (rec.data_date = ANY(v_datas_processadas)) THEN
            v_datas_processadas := array_append(v_datas_processadas, rec.data_date);
          END IF;
        WHEN 'pagamentos' THEN
          PERFORM public.process_pagamentos_data(rec.bar_id, v_data, rec.data_date);
        WHEN 'periodo' THEN
          PERFORM public.process_periodo_data(rec.bar_id, v_data, rec.data_date);
        WHEN 'tempo' THEN
          PERFORM public.process_tempo_data(rec.bar_id, v_data, rec.data_date);
        WHEN 'fatporhora' THEN
          PERFORM public.process_fatporhora_data(rec.bar_id, v_data, rec.data_date);
        WHEN 'cancelamentos' THEN
          PERFORM public.process_cancelamentos_data(rec.bar_id, v_data, rec.data_date);
        WHEN 'sinteticoporhorario' THEN
          PERFORM public.process_sinteticoporhorario_data(rec.bar_id, v_data, rec.data_date);
        WHEN 'notasfiscais' THEN
          PERFORM public.process_notasfiscais_data(rec.bar_id, v_data, rec.data_date);
        WHEN 'vendas' THEN
          NULL;
        ELSE
          CONTINUE;
      END CASE;

      UPDATE bronze.bronze_contahub_raw_data
      SET processed = true, processed_at = NOW()
      WHERE id = rec.id;
      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_result := v_result || format('ERRO id=%s %s: %s | ', rec.id, rec.data_type, SQLERRM);
    END;
  END LOOP;

  IF array_length(v_datas_processadas, 1) > 0 THEN
    FOR rec IN
      SELECT e.id FROM operations.eventos_base e
      WHERE e.data_evento = ANY(v_datas_processadas)
    LOOP
      BEGIN
        PERFORM public.calculate_evento_metrics(rec.id);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END IF;

  IF v_error_count > 0 THEN
    RAISE EXCEPTION 'processar_raw_data_pendente: % registros falharam, % sucesso. Detalhes: %',
      v_error_count, v_count, v_result;
  END IF;

  RETURN format('Processados: %s. Eventos: %s datas.', v_count, COALESCE(array_length(v_datas_processadas, 1), 0));
END;
$function$;
