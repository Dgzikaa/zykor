-- Aplicada via MCP em 2026-05-27.
-- Fix task #89: stockout_executar_completo usava pg_sleep(10) e falhava com
-- 'Bronze permaneceu vazio' porque a edge function contahub-stockout-sync
-- demora 30-45s (ContaHub lento). Sync_status ficava NULL e processamento
-- nunca era chamado.
--
-- Resultado: bar 3 ficou sem stockout em 25/05 e 26/05 (3 noites de cron falhando).
--
-- Solucao: polling loop que aguarda ate 60s (20 tentativas de 3s) pela resposta.

CREATE OR REPLACE FUNCTION public.stockout_executar_completo(
  p_bar_id integer,
  p_data_date date DEFAULT CURRENT_DATE,
  p_triggered_by text DEFAULT 'manual'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'silver', 'bronze', 'operations', 'pg_catalog'
AS $function$
DECLARE
  v_started_at TIMESTAMPTZ := clock_timestamp();
  v_sync_req_id bigint;
  v_proc_req_id bigint;
  v_sync_status integer;
  v_proc_status integer;
  v_bronze_count integer := 0;
  v_silver_count integer := 0;
  v_incluidos integer := 0;
  v_excluidos integer := 0;
  v_percent numeric(6,2) := 0;
  v_versao text;
  v_status text := 'ok';
  v_erro text;
  v_tempo_ms integer;
  v_bar_opera boolean := true;
  v_dia_semana integer := EXTRACT(DOW FROM p_data_date)::integer;
  v_tentativas integer := 0;
  v_max_tentativas integer := 20;
BEGIN
  SET LOCAL statement_timeout = '5min';

  SELECT CASE v_dia_semana
    WHEN 0 THEN bc.opera_domingo WHEN 1 THEN bc.opera_segunda
    WHEN 2 THEN bc.opera_terca WHEN 3 THEN bc.opera_quarta
    WHEN 4 THEN bc.opera_quinta WHEN 5 THEN bc.opera_sexta
    WHEN 6 THEN bc.opera_sabado
  END INTO v_bar_opera
  FROM operations.bares_config bc WHERE bc.bar_id = p_bar_id;

  IF NOT COALESCE(v_bar_opera, true) THEN
    v_status := 'skip_bar_fechado';
    v_tempo_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started_at)::integer;
    INSERT INTO silver.stockout_execucao_log
      (bar_id, data_consulta, triggered_by, status, tempo_total_ms)
    VALUES (p_bar_id, p_data_date, p_triggered_by, v_status, v_tempo_ms);
    RETURN jsonb_build_object('status', v_status, 'bar_id', p_bar_id, 'data', p_data_date);
  END IF;

  BEGIN
    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/contahub-stockout-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || get_service_role_key(),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'bar_id', p_bar_id,
        'data_date', p_data_date::text,
        'source', p_triggered_by
      ),
      timeout_milliseconds := 60000
    ) INTO v_sync_req_id;

    -- Polling: aguarda resposta ate 60s (20 x 3s)
    LOOP
      v_tentativas := v_tentativas + 1;
      PERFORM pg_sleep(3);
      SELECT r.status_code INTO v_sync_status
      FROM net._http_response r WHERE r.id = v_sync_req_id LIMIT 1;
      EXIT WHEN v_sync_status IS NOT NULL OR v_tentativas >= v_max_tentativas;
    END LOOP;

    SELECT COUNT(*) INTO v_bronze_count
    FROM bronze.bronze_contahub_operacional_stockout_raw
    WHERE bar_id = p_bar_id AND data_consulta::date = p_data_date;

    IF v_bronze_count = 0 THEN
      v_status := 'erro_sync_vazio';
      RAISE EXCEPTION 'Bronze permaneceu vazio apos sync (status=%, req=%, tentativas=%)',
        v_sync_status, v_sync_req_id, v_tentativas;
    END IF;

    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/stockout-processar',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || get_service_role_key(),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'bar_id', p_bar_id,
        'data_date', p_data_date::text
      ),
      timeout_milliseconds := 60000
    ) INTO v_proc_req_id;

    v_tentativas := 0;
    LOOP
      v_tentativas := v_tentativas + 1;
      PERFORM pg_sleep(2);
      SELECT r.status_code INTO v_proc_status
      FROM net._http_response r WHERE r.id = v_proc_req_id LIMIT 1;
      EXIT WHEN v_proc_status IS NOT NULL OR v_tentativas >= 15;
    END LOOP;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE incluido), COUNT(*) FILTER (WHERE NOT incluido),
           MAX(versao_regras)
    INTO v_silver_count, v_incluidos, v_excluidos, v_versao
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id AND data_consulta = p_data_date;

    IF v_silver_count = 0 THEN
      v_status := 'erro_silver_vazio';
      RAISE EXCEPTION 'Silver permaneceu vazio apos processar (status=%, req=%)', v_proc_status, v_proc_req_id;
    END IF;

    IF v_incluidos > 0 THEN
      SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE prd_ativo != 'S' OR prd_venda = 'N')::numeric / v_incluidos, 2)
      INTO v_percent
      FROM silver.silver_contahub_operacional_stockout_processado
      WHERE bar_id = p_bar_id AND data_consulta = p_data_date AND incluido;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_erro := SQLERRM;
    IF v_status = 'ok' THEN v_status := 'erro_excecao'; END IF;
  END;

  v_tempo_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_started_at)::integer;

  INSERT INTO silver.stockout_execucao_log (
    bar_id, data_consulta, triggered_by, status,
    sync_status, sync_req_id, proc_status, proc_req_id,
    bronze_linhas, silver_linhas, incluidos, excluidos,
    percentual_stockout, tempo_total_ms, versao_regras, erro_msg
  ) VALUES (
    p_bar_id, p_data_date, p_triggered_by, v_status,
    v_sync_status, v_sync_req_id, v_proc_status, v_proc_req_id,
    v_bronze_count, v_silver_count, v_incluidos, v_excluidos,
    v_percent, v_tempo_ms, v_versao, v_erro
  );

  RETURN jsonb_build_object(
    'status', v_status, 'bar_id', p_bar_id, 'data', p_data_date,
    'bronze_linhas', v_bronze_count, 'silver_linhas', v_silver_count,
    'incluidos', v_incluidos, 'excluidos', v_excluidos,
    'percentual_stockout', v_percent, 'tempo_ms', v_tempo_ms, 'erro', v_erro
  );
END;
$function$;
