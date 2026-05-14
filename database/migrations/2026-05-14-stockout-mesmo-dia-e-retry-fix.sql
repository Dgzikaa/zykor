-- Stockout: processar mesmo dia + corrigir statement_timeout do retry
-- ============================================================================
-- Contexto:
-- 1) Em 14/05 dashboard /ferramentas/stockout estava ZERADO para Ord e Deb (D-1=13/05).
--    Causa imediata: silver de 13/05 vazio porque o cron retry das 10:20 BRT
--    (revalidar_stockout_dia_anterior_ambos_bares_v2) FALHOU com:
--       ERROR: canceling statement due to statement timeout
--       CONTEXT: SQL statement "SELECT pg_sleep(25)"
--    statement_timeout do role postgres = 2min. Soma de pg_sleeps na funcao
--    (20 + 25 + 10 + 25 + 15 = 95s) + overhead HTTP de 2 chamadas pg_net
--    estourou o limite. Esse aumento de 10→25s veio do fix de 13/05
--    (race condition no auto-heal). Fix anti-falso-positivo virou causa de
--    silencio total.
--
-- 2) Bug de design no cron principal de processar:
--      stockout-processar-auto-ordinario  19:30 BRT  body data_date=CURRENT_DATE-1
--      stockout-processar-auto-deboche    19:45 BRT  body data_date=CURRENT_DATE-1
--    Ou seja: o cron que roda em 13/05 19:30 processa silver do dia 12/05 (D-1),
--    nao do dia 13/05. Silver do dia atual so' nasce na noite seguinte. Janela
--    de "stockout zerado durante o dia" depende inteiramente do retry matinal.
--
-- Fix:
--   a) Cron principal passa a processar CURRENT_DATE (mesmo dia da coleta).
--      Coleta acontece 19:00/19:10 (data=CURRENT_DATE), processar 19:30/19:45
--      transforma o que acabou de chegar.
--   b) Funcao revalidar_stockout_dia_anterior_ambos_bares_v2 ganha
--      `SET LOCAL statement_timeout = '5min'` no inicio do BEGIN para sobrescrever
--      o limite de 2min herdado do pg_cron.
--   c) Novo cron stockout-retry-d-1-tarde 16:00 BRT (19:00 UTC) chama a mesma
--      funcao como segunda chance se o retry das 10:20 falhar. Custo zero quando
--      silver D-1 ja esta populado (funcao tem `IF v_count_silver = 0`).
--
-- Resultado esperado:
--   - 14/05 19:30 BRT: silver de 14/05 nasce no mesmo dia (era 15/05).
--   - 15/05 10:20 BRT: retry roda em ate 5min se silver D-1 ainda vazio.
--   - 15/05 16:00 BRT: segunda tentativa caso 10:20 falhe.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Cron processar Ordinario (jobid 402) — usar CURRENT_DATE
-- ----------------------------------------------------------------------------
SELECT cron.alter_job(
  job_id := 402,
  command := $cmd$
    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/stockout-processar',
      headers := jsonb_build_object('Authorization', 'Bearer ' || get_service_role_key(), 'Content-Type', 'application/json'),
      body := jsonb_build_object('bar_id', 3, 'data_date', CURRENT_DATE::text),
      timeout_milliseconds := 60000
    )
  $cmd$
);

-- ----------------------------------------------------------------------------
-- 2) Cron processar Deboche (jobid 403) — usar CURRENT_DATE
-- ----------------------------------------------------------------------------
SELECT cron.alter_job(
  job_id := 403,
  command := $cmd$
    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/stockout-processar',
      headers := jsonb_build_object('Authorization', 'Bearer ' || get_service_role_key(), 'Content-Type', 'application/json'),
      body := jsonb_build_object('bar_id', 4, 'data_date', CURRENT_DATE::text),
      timeout_milliseconds := 60000
    )
  $cmd$
);

-- ----------------------------------------------------------------------------
-- 3) Funcao retry: SET LOCAL statement_timeout = '5min'
--    Mesma logica do fix de 13/05; unica mudanca e' a primeira linha do BEGIN.
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
  -- pg_cron herda statement_timeout=2min do role postgres; sleeps + HTTP estouram.
  -- Override para 5min cobre o pior caso (95s pg_sleep + 2 chamadas HTTP).
  SET LOCAL statement_timeout = '5min';

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
-- 4) Novo cron retry tarde 16:00 BRT (19:00 UTC) — segunda chance
--    Funcao tem `IF v_count_silver = 0` no inicio: se 10:20 ja heal'ou, sai em <1s.
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

SELECT cron.schedule(
  'stockout-retry-d-1-tarde',
  '0 19 * * *',
  'SELECT * FROM public.revalidar_stockout_dia_anterior_ambos_bares_v2();'
);

COMMIT;

-- ----------------------------------------------------------------------------
-- Validacao manual sugerida apos aplicar:
--   SELECT jobid, jobname, schedule, command FROM cron.job
--    WHERE jobname IN (
--      'stockout-processar-auto-ordinario',
--      'stockout-processar-auto-deboche',
--      'stockout-retry-d-1-tarde'
--    );
--   -- Hoje 19:30 BRT silver de 14/05 deve nascer; checar:
--   SELECT bar_id, data_consulta, COUNT(*), MIN(processado_em)
--     FROM silver.silver_contahub_operacional_stockout_processado
--    WHERE data_consulta = CURRENT_DATE GROUP BY 1,2;
-- ----------------------------------------------------------------------------
