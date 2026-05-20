-- 2026-05-20 — Fix da assinatura do pg_advisory_xact_lock + hardening do processador
--
-- INCIDENTE
-- Migration 2026-05-19-contahub-process-data-advisory-lock.sql chamou
--   pg_advisory_xact_lock(p_bar_id::bigint, EXTRACT(epoch FROM p_data_date)::bigint)
-- A versão de 2 argumentos só existe como (integer, integer); a (bigint, bigint)
-- não existe. Toda chamada lançou exceção "function does not exist", o EXCEPTION
-- WHEN OTHERS engoliu silenciosamente, processar_raw_data_pendente() retornou
-- "Processados: 0" e pg_cron marcou succeeded em 141ms. Resultado: 6 tipos × 2
-- bares = 12 raw rows de 2026-05-19 ficaram com processed=false.
--
-- FIX
-- 1) Cast (integer, integer) — epoch cabe em int4 até 2038.
-- 2) processar_raw_data_pendente faz RAISE EXCEPTION no final se algum loop
--    levantou erro. pg_cron passa a marcar `failed` em vez de silenciar.

CREATE OR REPLACE FUNCTION public.process_analitico_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(p_bar_id::integer, EXTRACT(epoch FROM p_data_date)::integer);

    DELETE FROM bronze.bronze_contahub_avendas_porproduto_analitico
    WHERE bar_id = p_bar_id AND trn_dtgerencial = p_data_date;

    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO bronze.bronze_contahub_avendas_porproduto_analitico (
            bar_id, vd_mesadesc, vd_localizacao, itm, trn, trn_desc, trn_dtgerencial,
            prefixo, tipo, tipovenda, ano, mes, usr_lancou, prd, prd_desc, grp_desc,
            loc_desc, qtd, desconto, valorfinal, custo, itm_obs, comandaorigem, itemorigem
        ) VALUES (
            p_bar_id,
            item_json->>'vd_mesadesc',
            item_json->>'vd_localizacao',
            NULLIF(item_json->>'itm', '')::integer,
            NULLIF(item_json->>'trn', '')::integer,
            item_json->>'trn_desc',
            NULLIF(LEFT(item_json->>'trn_dtgerencial', 10), '')::date,
            item_json->>'prefixo',
            item_json->>'tipo',
            item_json->>'tipovenda',
            NULLIF(item_json->>'ano', '')::integer,
            CASE
                WHEN item_json->>'mes' ~ '^\d{4}-\d{2}$' THEN SUBSTRING(item_json->>'mes', 6, 2)::integer
                WHEN item_json->>'mes' ~ '^\d+$' THEN (item_json->>'mes')::integer
                ELSE NULL
            END,
            item_json->>'usr_lancou',
            item_json->>'prd',
            item_json->>'prd_desc',
            item_json->>'grp_desc',
            item_json->>'loc_desc',
            NULLIF(item_json->>'qtd', '')::numeric,
            NULLIF(item_json->>'desconto', '')::numeric,
            NULLIF(item_json->>'valorfinal', '')::numeric,
            NULLIF(item_json->>'custo', '')::numeric,
            item_json->>'itm_obs',
            item_json->>'comandaorigem',
            item_json->>'itemorigem'
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_cancelamentos_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(p_bar_id::integer, EXTRACT(epoch FROM p_data_date)::integer);

    DELETE FROM bronze.bronze_contahub_avendas_cancelamentos
    WHERE bar_id = p_bar_id AND dt_gerencial = p_data_date;

    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO bronze.bronze_contahub_avendas_cancelamentos (
            bar_id, vd, itm, prd, trn, lancou, cancelou, itm_qtd, itm_obs, grp_desc,
            prd_desc, prd_unid, itm_vrcheio, itm_vrunitario, custototal, prd_precocusto,
            vd_mesadesc, vd_obs, motivocancdesconto, dt_gerencial
        ) VALUES (
            p_bar_id,
            NULLIF(item_json->>'vd', '')::integer,
            NULLIF(item_json->>'itm', '')::integer,
            item_json->>'prd',
            item_json->>'trn',
            item_json->>'lancou',
            item_json->>'cancelou',
            NULLIF(item_json->>'itm_qtd', '')::numeric,
            item_json->>'itm_obs',
            item_json->>'grp_desc',
            item_json->>'prd_desc',
            item_json->>'prd_unid',
            NULLIF(item_json->>'itm_vrcheio', '')::numeric,
            NULLIF(item_json->>'itm_vrunitario', '')::numeric,
            NULLIF(item_json->>'custototal', '')::numeric,
            NULLIF(item_json->>'prd_precocusto', '')::numeric,
            item_json->>'vd_mesadesc',
            item_json->>'vd_obs',
            item_json->>'motivocancdesconto',
            NULLIF(LEFT(item_json->>'dt_gerencial', 10), '')::date
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_fatporhora_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
    data_list jsonb;
BEGIN
    PERFORM pg_advisory_xact_lock(p_bar_id::integer, EXTRACT(epoch FROM p_data_date)::integer);

    data_list := CASE
      WHEN jsonb_typeof(p_data_array) = 'object' AND p_data_array ? 'list' THEN p_data_array->'list'
      ELSE p_data_array
    END;

    DELETE FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
    WHERE bar_id = p_bar_id AND vd_dtgerencial = p_data_date;

    FOR item_json IN SELECT jsonb_array_elements(data_list) LOOP
        INSERT INTO bronze.bronze_contahub_avendas_vendasdiahoraanalitico (
            bar_id, vd_dtgerencial, dds, dia, hora, qtd, valor
        ) VALUES (
            p_bar_id,
            NULLIF(LEFT(item_json->>'vd_dtgerencial', 10), '')::date,
            NULLIF(item_json->>'dds', '')::integer,
            item_json->>'dia',
            item_json->>'hora',
            NULLIF(item_json->>'qtd', '')::numeric,
            NULLIF(item_json->>'$valor', '')::numeric
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_pagamentos_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(p_bar_id::integer, EXTRACT(epoch FROM p_data_date)::integer);

    DELETE FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
    WHERE bar_id = p_bar_id AND dt_gerencial = p_data_date;

    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO bronze.bronze_contahub_financeiro_pagamentosrecebidos (
            bar_id, vd, trn, pag, pos, mesa, tipo, meio, cartao, autorizacao,
            motivodesconto, dt_gerencial, dt_transacao, hr_lancamento, hr_transacao,
            valor, liquido, vr_pagamentos, cli, cliente, cli_fone, cli_cpf,
            usr_abriu, usr_lancou, usr_aceitou
        ) VALUES (
            p_bar_id,
            item_json->>'vd',
            item_json->>'trn',
            item_json->>'pag',
            NULLIF(item_json->>'pos', '')::integer,
            item_json->>'mesa',
            item_json->>'tipo',
            item_json->>'meio',
            item_json->>'cartao',
            item_json->>'autorizacao',
            item_json->>'motivodesconto',
            NULLIF(item_json->>'dt_gerencial', '')::date,
            NULLIF(item_json->>'dt_transacao', '')::date,
            item_json->>'hr_lancamento',
            item_json->>'hr_transacao',
            NULLIF(item_json->>'$valor', '')::numeric,
            NULLIF(item_json->>'$liquido', '')::numeric,
            NULLIF(item_json->>'$vr_pagamentos', '')::numeric,
            NULLIF(item_json->>'cli', '')::integer,
            item_json->>'cli_nome',
            item_json->>'cli_fone',
            item_json->>'cli_cpf',
            item_json->>'usr_abriu',
            item_json->>'usr_lancou',
            item_json->>'usr_aceitou'
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_periodo_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(p_bar_id::integer, EXTRACT(epoch FROM p_data_date)::integer);

    DELETE FROM bronze.bronze_contahub_avendas_vendasperiodo
    WHERE bar_id = p_bar_id AND vd_dtgerencial = p_data_date;

    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO bronze.bronze_contahub_avendas_vendasperiodo (
            bar_id, vd, trn, trn_desc, trn_dtgerencial, vd_dtgerencial, prefixo,
            tipovenda, vd_mesadesc, vd_localizacao, usrabriu, vd_pessoas, vd_qtditens,
            vd_vrpagamentos, vd_vrprodutos, vd_vrrepique, vd_vrcouvert, vd_vrdescontos,
            vd_motivodesconto, cli_nome, cli_fone, cpf, nf_autorizada, nf_chaveacesso,
            nf_dtcontabil
        ) VALUES (
            p_bar_id,
            NULLIF(item_json->>'vd', '')::integer,
            NULLIF(item_json->>'trn', '')::integer,
            item_json->>'trn_desc',
            NULLIF(LEFT(item_json->>'trn_dtgerencial', 10), '')::date,
            NULLIF(LEFT(item_json->>'vd_dtgerencial', 10), '')::date,
            item_json->>'prefixo',
            item_json->>'tipovenda',
            item_json->>'vd_mesadesc',
            item_json->>'vd_localizacao',
            item_json->>'usrabriu',
            NULLIF(item_json->>'vd_pessoas', '')::numeric,
            NULLIF(item_json->>'vd_qtditens', '')::numeric,
            NULLIF(item_json->>'vd_vrpagamentos', '')::numeric,
            NULLIF(item_json->>'vd_vrprodutos', '')::numeric,
            NULLIF(item_json->>'vd_vrrepique', '')::numeric,
            NULLIF(item_json->>'vd_vrcouvert', '')::numeric,
            NULLIF(item_json->>'vd_vrdescontos', '')::numeric,
            item_json->>'vd_motivodesconto',
            item_json->>'cli_nome',
            item_json->>'cli_fone',
            item_json->>'cpf',
            item_json->>'nf_autorizada',
            item_json->>'nf_chaveacesso',
            NULLIF(LEFT(item_json->>'nf_dtcontabil', 10), '')::date
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_tempo_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(p_bar_id::integer, EXTRACT(epoch FROM p_data_date)::integer);

    DELETE FROM bronze.bronze_contahub_produtos_temposproducao
    WHERE bar_id = p_bar_id AND data = p_data_date;

    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO bronze.bronze_contahub_produtos_temposproducao (
            bar_id, data, ano, mes, dia, dds, diadasemana, hora,
            itm, itm_qtd, prd, prd_desc, grp_desc, loc_desc, prefixo, tipovenda,
            vd_mesadesc, vd_localizacao,
            usr_abriu, usr_lancou, usr_produziu, usr_entregou, usr_transfcancelou,
            t0_lancamento, t1_prodini, t2_prodfim, t3_entrega,
            t0_t1, t0_t2, t0_t3, t1_t2, t1_t3, t2_t3
        ) VALUES (
            p_bar_id, p_data_date,
            NULLIF(item_json->>'ano', '')::integer,
            CASE
                WHEN item_json->>'mes' ~ '^\d{4}-\d{2}$' THEN SUBSTRING(item_json->>'mes', 6, 2)::integer
                WHEN item_json->>'mes' ~ '^\d+$' THEN (item_json->>'mes')::integer
                ELSE NULL
            END,
            NULLIF(LEFT(item_json->>'dia', 10), '')::date,
            NULLIF(item_json->>'dds', '')::integer,
            item_json->>'diadasemana',
            item_json->>'hora',
            item_json->>'itm',
            NULLIF(item_json->>'itm_qtd', '')::numeric,
            NULLIF(item_json->>'prd', '')::integer,
            item_json->>'prd_desc',
            item_json->>'grp_desc',
            item_json->>'loc_desc',
            item_json->>'prefixo',
            item_json->>'tipovenda',
            item_json->>'vd_mesadesc',
            item_json->>'vd_localizacao',
            item_json->>'usr_abriu',
            item_json->>'usr_lancou',
            item_json->>'usr_produziu',
            item_json->>'usr_entregou',
            item_json->>'usr_transfcancelou',
            NULLIF(item_json->>'t0-lancamento', '')::timestamptz AT TIME ZONE 'America/Sao_Paulo',
            NULLIF(item_json->>'t1-prodini', '')::timestamptz AT TIME ZONE 'America/Sao_Paulo',
            NULLIF(item_json->>'t2-prodfim', '')::timestamptz AT TIME ZONE 'America/Sao_Paulo',
            NULLIF(item_json->>'t3-entrega', '')::timestamptz AT TIME ZONE 'America/Sao_Paulo',
            NULLIF(item_json->>'t0-t1', '')::numeric,
            NULLIF(item_json->>'t0-t2', '')::numeric,
            NULLIF(item_json->>'t0-t3', '')::numeric,
            NULLIF(item_json->>'t1-t2', '')::numeric,
            NULLIF(item_json->>'t1-t3', '')::numeric,
            NULLIF(item_json->>'t2-t3', '')::numeric
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$function$;

-- Hardening: processar_raw_data_pendente passa a RAISE EXCEPTION se algum
-- registro falhou. Trade-off: a transação inteira rola back (registros que
-- haviam dado sucesso voltam a processed=false), mas a próxima execução
-- reprocessa limpo e pg_cron marca `failed` em vez de silenciar.
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
