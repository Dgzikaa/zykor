-- Rollback: Stockout mesmo-dia + retry timeout fix
-- ============================================================================
-- Reverte:
--   1) cron 402 (Ord) e 403 (Deb) voltam a usar CURRENT_DATE - 1
--   2) revalidar_stockout_dia_anterior_ambos_bares_v2 sem SET LOCAL statement_timeout
--   3) Remove cron stockout-retry-d-1-tarde
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Cron processar Ord — voltar a CURRENT_DATE - 1 day
-- ----------------------------------------------------------------------------
SELECT cron.alter_job(
  job_id := 402,
  command := $cmd$
    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/stockout-processar',
      headers := jsonb_build_object('Authorization', 'Bearer ' || get_service_role_key(), 'Content-Type', 'application/json'),
      body := jsonb_build_object('bar_id', 3, 'data_date', (CURRENT_DATE - INTERVAL '1 day')::date::text),
      timeout_milliseconds := 60000
    )
  $cmd$
);

-- ----------------------------------------------------------------------------
-- 2) Cron processar Deb — voltar a CURRENT_DATE - 1 day
-- ----------------------------------------------------------------------------
SELECT cron.alter_job(
  job_id := 403,
  command := $cmd$
    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/stockout-processar',
      headers := jsonb_build_object('Authorization', 'Bearer ' || get_service_role_key(), 'Content-Type', 'application/json'),
      body := jsonb_build_object('bar_id', 4, 'data_date', (CURRENT_DATE - INTERVAL '1 day')::date::text),
      timeout_milliseconds := 60000
    )
  $cmd$
);

-- ----------------------------------------------------------------------------
-- 3) Funcao retry — sem SET LOCAL statement_timeout (volta ao estado de 13/05)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revalidar_stockout_dia_anterior_ambos_bares_v2()
RETURNS TABLE(bar_id integer, data_ref date, tinha_silver boolean, tinha_bronze boolean, coleta_executada boolean, processamento_executado boolean, silver_apos_heal integer, alerta_disparado boolean, error_msg text)
LANGUAGE plpgsql
SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
  v_bar integer;
  v_data date := (current_date - interval '1 day')::date;
  v_dia_semana integer := EXTRACT(DOW FROM (current_date - interval '1 day')::date)::integer;
  v_count_silver integer;
  v_count_bronze integer;
  v_count_silver_apos integer;
  v_req_id_coleta bigint;
  v_req_id_proc bigint;
  v_status_coleta integer;
  v_status_proc integer;
  v_resp_msg text;
  v_coleta boolean;
  v_proc boolean;
  v_alerta boolean;
  v_error text;
  v_bar_opera boolean;
  v_tentativas integer;
BEGIN
  FOREACH v_bar IN ARRAY ARRAY[3,4]
  LOOP
    v_count_silver := 0; v_count_bronze := 0; v_count_silver_apos := 0;
    v_req_id_coleta := NULL; v_req_id_proc := NULL;
    v_status_coleta := NULL; v_status_proc := NULL; v_resp_msg := NULL;
    v_coleta := false; v_proc := false; v_alerta := false;
    v_error := NULL; v_bar_opera := true; v_tentativas := 0;

    BEGIN
      SELECT CASE v_dia_semana
        WHEN 0 THEN bc.opera_domingo WHEN 1 THEN bc.opera_segunda
        WHEN 2 THEN bc.opera_terca WHEN 3 THEN bc.opera_quarta
        WHEN 4 THEN bc.opera_quinta WHEN 5 THEN bc.opera_sexta
        WHEN 6 THEN bc.opera_sabado
      END INTO v_bar_opera
      FROM operations.bares_config bc WHERE bc.bar_id = v_bar;

      IF NOT COALESCE(v_bar_opera, true) THEN
        RAISE NOTICE 'Bar % nao opera no DOW=%, pulando', v_bar, v_dia_semana;
      ELSE
        SELECT COUNT(*) INTO v_count_silver
        FROM silver.silver_contahub_operacional_stockout_processado s
        WHERE s.bar_id = v_bar AND s.data_consulta = v_data;

        SELECT COUNT(*) INTO v_count_bronze
        FROM bronze.bronze_contahub_operacional_stockout_raw b
        WHERE b.bar_id = v_bar AND b.data_consulta = v_data;

        IF v_count_silver = 0 THEN
          RAISE NOTICE 'Bar % - silver vazio em %, bronze=% — auto-heal', v_bar, v_data, v_count_bronze;

          IF v_count_bronze = 0 THEN
            SELECT net.http_post(
              url := get_supabase_url() || '/functions/v1/contahub-stockout-sync',
              body := jsonb_build_object('bar_id', v_bar, 'data_date', v_data::text, 'source', 'pgcron-retry-d-1'),
              headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || get_service_role_key()),
              timeout_milliseconds := 60000
            ) INTO v_req_id_coleta;
            v_coleta := true;
            PERFORM pg_sleep(20);

            SELECT r.status_code INTO v_status_coleta
            FROM net._http_response r WHERE r.id = v_req_id_coleta LIMIT 1;
          END IF;

          WHILE v_tentativas < 2 LOOP
            v_tentativas := v_tentativas + 1;

            SELECT net.http_post(
              url := get_supabase_url() || '/functions/v1/stockout-processar',
              body := jsonb_build_object('bar_id', v_bar, 'data_date', v_data::text),
              headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || get_service_role_key()),
              timeout_milliseconds := 60000
            ) INTO v_req_id_proc;
            v_proc := true;
            PERFORM pg_sleep(25);

            SELECT r.status_code, r.content INTO v_status_proc, v_resp_msg
            FROM net._http_response r WHERE r.id = v_req_id_proc LIMIT 1;

            SELECT COUNT(*) INTO v_count_silver_apos
            FROM silver.silver_contahub_operacional_stockout_processado s2
            WHERE s2.bar_id = v_bar AND s2.data_consulta = v_data;

            EXIT WHEN v_count_silver_apos > 0;

            IF v_tentativas < 2 THEN
              RAISE NOTICE 'Bar % - retry % (status=%, silver=0): %', v_bar, v_tentativas, COALESCE(v_status_proc::text,'null'), LEFT(COALESCE(v_resp_msg, 'null'), 200);
              PERFORM pg_sleep(10);
            END IF;
          END LOOP;

          IF v_count_silver_apos = 0 THEN
            PERFORM pg_sleep(15);
            SELECT COUNT(*) INTO v_count_silver_apos
            FROM silver.silver_contahub_operacional_stockout_processado s3
            WHERE s3.bar_id = v_bar AND s3.data_consulta = v_data;
          END IF;

          IF v_count_silver_apos = 0 THEN
            v_alerta := true;
            BEGIN
              PERFORM public.enviar_alerta_discord_sistema_dedup(
                v_bar, 'erro', 'pipeline_saude',
                '🚨 Stockout D-1 sem dados (auto-heal falhou)',
                'Bar ' || v_bar::text || ' silver vazio em ' || v_data::text || ' apos ' || v_tentativas::text || ' tentativas. Bronze=' || v_count_bronze::text || '. status_code processar=' || COALESCE(v_status_proc::text, 'null') || '. Verificar edge function stockout-processar.',
                15158332,
                'stockout_silencioso_d1_' || v_data::text || '_' || v_bar::text
              );
            EXCEPTION WHEN OTHERS THEN
              v_error := 'alerta_falhou: ' || SQLERRM;
            END;
          END IF;
        ELSE
          RAISE NOTICE 'Bar % - silver ja tem % linhas em %, skip', v_bar, v_count_silver, v_data;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_error := SQLERRM;
      RAISE NOTICE 'Bar % - Erro: %', v_bar, v_error;
      BEGIN
        PERFORM public.enviar_alerta_discord_sistema_dedup(
          v_bar, 'erro', 'pipeline_saude',
          '🚨 Stockout D-1 retry com erro SQL',
          'Bar ' || v_bar::text || ' data ' || v_data::text || ': ' || v_error,
          15158332,
          'stockout_retry_erro_' || v_data::text || '_' || v_bar::text
        );
        v_alerta := true;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;

    bar_id := v_bar;
    data_ref := v_data;
    tinha_silver := (v_count_silver > 0);
    tinha_bronze := (v_count_bronze > 0);
    coleta_executada := v_coleta;
    processamento_executado := v_proc;
    silver_apos_heal := v_count_silver_apos;
    alerta_disparado := v_alerta;
    error_msg := v_error;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- ----------------------------------------------------------------------------
-- 4) Remover cron stockout-retry-d-1-tarde
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_existing_id integer;
BEGIN
  SELECT jobid INTO v_existing_id FROM cron.job WHERE jobname = 'stockout-retry-d-1-tarde';
  IF v_existing_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_id);
  END IF;
END $$;

COMMIT;
