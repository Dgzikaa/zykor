-- 2026-04-29: Fix revalidar_stockout_dia_anterior_ambos_bares_v2 + alerta loud
--
-- Bug detectado em 28/04:
--   * Silver vazio o dia inteiro (Ord+Deb).
--   * Bronze raw populado (641 + 212 linhas) pelas 19h.
--   * Crons 402/403 (stockout-processar 22:30/22:45 UTC) dispararam mas
--     edge function falhou silenciosamente.
--   * Cron 312 (alerta-stockout-faltante 10:40 BRT) so alerta D-1, mas
--     dependia do retry (cron 352) ja ter rodado e funcionado.
--   * Cron 352 (07:20 BRT) revalidar_stockout... estava QUEBRADO ha tempo:
--     referencia 'contahub_stockout' e 'contahub_stockout_processado' que
--     nao existem mais (renomeadas pra schema bronze/silver). Erro ia pro
--     EXCEPTION e era silenciosamente swallowed.
--
-- Caso real: socio descobriu manual em 29/04 14h que stockout 28/04
-- estava zerado. Tive que re-disparar stockout-processar manual.
--
-- Fix:
--   1. DROP+CREATE com return type novo (mais clareza pro caller)
--   2. Apontar pras tabelas corretas:
--      bronze.bronze_contahub_operacional_stockout_raw
--      silver.silver_contahub_operacional_stockout_processado
--   3. Auto-heal: se silver vazio, dispara sync (se bronze tambem vazio)
--      + processar (sempre).
--   4. Apos auto-heal, se silver continuar vazio: dispara alerta Discord
--      via enviar_alerta_discord_sistema_dedup (loud).
--   5. Se erro SQL inesperado: tambem dispara alerta.
--
-- Cron 352 (jobid 352, 07:20 BRT diario) ja chama essa funcao — sem
-- mudanca no schedule.

DROP FUNCTION IF EXISTS public.revalidar_stockout_dia_anterior_ambos_bares_v2();

CREATE OR REPLACE FUNCTION public.revalidar_stockout_dia_anterior_ambos_bares_v2()
RETURNS TABLE(
  bar_id integer, data_ref date,
  tinha_silver boolean, tinha_bronze boolean,
  coleta_executada boolean, processamento_executado boolean,
  silver_apos_heal integer,
  alerta_disparado boolean,
  error_msg text
)
LANGUAGE plpgsql
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
  v_coleta boolean;
  v_proc boolean;
  v_alerta boolean;
  v_error text;
  v_bar_opera boolean;
BEGIN
  FOREACH v_bar IN ARRAY ARRAY[3,4]
  LOOP
    v_count_silver := 0; v_count_bronze := 0; v_count_silver_apos := 0;
    v_req_id_coleta := NULL; v_req_id_proc := NULL;
    v_coleta := false; v_proc := false; v_alerta := false;
    v_error := NULL; v_bar_opera := true;

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
            PERFORM pg_sleep(8);
          END IF;

          SELECT net.http_post(
            url := get_supabase_url() || '/functions/v1/stockout-processar',
            body := jsonb_build_object('bar_id', v_bar, 'data_date', v_data::text),
            headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || get_service_role_key()),
            timeout_milliseconds := 60000
          ) INTO v_req_id_proc;
          v_proc := true;
          PERFORM pg_sleep(5);

          SELECT COUNT(*) INTO v_count_silver_apos
          FROM silver.silver_contahub_operacional_stockout_processado s2
          WHERE s2.bar_id = v_bar AND s2.data_consulta = v_data;

          IF v_count_silver_apos = 0 THEN
            v_alerta := true;
            PERFORM public.enviar_alerta_discord_sistema_dedup(
              v_bar, 'erro', 'pipeline_saude',
              '🚨 Stockout D-1 sem dados (auto-heal falhou)',
              'Bar ' || v_bar::text || ' silver vazio em ' || v_data::text || ' apos retry. Bronze=' || v_count_bronze::text || '. Verificar edge function stockout-processar.',
              15158332,
              'stockout_silencioso_d1_' || v_data::text || '_' || v_bar::text
            );
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
