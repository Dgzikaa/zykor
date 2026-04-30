-- 2026-04-30: 2 fixes pra parar bug recorrente de stockout silencioso
--
-- Caso real (29/04): bronze populado as 19h, mas silver ficou vazio o dia
-- todo. Cron 352 (auto-heal D-1) rodou em 30/04 07:20, mostrou succeeded,
-- mas silver continuou 0. Funcionario abriu a tela na manha seguinte e nao
-- viu dados.
--
-- Causa raiz dupla:
--   1. A funcao de alerta enviar_alerta_discord_sistema_dedup referenciava
--      'alertas_enviados' sem schema. Tabela esta em system.alertas_enviados.
--      ERROR 'relation does not exist' caia no EXCEPTION e mascarava todo
--      o problema — auto-heal achava que tinha alertado quando NADA tinha
--      sido alertado.
--   2. revalidar_stockout..._v2 chamava net.http_post pra stockout-processar,
--      ganhava request_id e considerava 'processamento_executado=true' MESMO
--      se a edge function falhasse depois. Nenhuma checagem de status_code.
--      Resultado: cron retornava 'succeeded' com silver continuando vazio.
--
-- Fix 1: prefixar system.alertas_enviados na funcao de alerta (search_path
-- da funcao nao incluia 'system').
-- Fix 2: revalidar_stockout_..._v2 agora:
--   - Aguarda 10s apos http_post
--   - Le net._http_response e valida status_code
--   - Faz ate 2 tentativas se silver continuar vazio
--   - Inclui status_code no payload do alerta Discord
--   - Tem nested try/except pra alerta nao explodir ainda silenciosamente

CREATE OR REPLACE FUNCTION public.enviar_alerta_discord_sistema_dedup(
  p_bar_id integer,
  p_tipo text,
  p_categoria text,
  p_titulo text,
  p_mensagem text,
  p_cor integer DEFAULT 15158332,
  p_dedupe_key text DEFAULT NULL::text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_key text;
  v_req_id bigint;
  v_ja_existe boolean;
BEGIN
  v_key := COALESCE(
    p_dedupe_key,
    md5(COALESCE(p_categoria,'') || '|' || COALESCE(p_titulo,'') || '|' || COALESCE(p_mensagem,''))
  );

  SELECT EXISTS (
    SELECT 1
    FROM system.alertas_enviados
    WHERE categoria = p_categoria
      AND (dados->>'dedupe_key') = v_key
      AND criado_em::date = current_date
  ) INTO v_ja_existe;

  IF v_ja_existe THEN
    RETURN 'SKIPPED_DUPLICATE key=' || v_key;
  END IF;

  SELECT public.enviar_alerta_discord_sistema(
    p_titulo,
    p_mensagem,
    p_cor
  ) INTO v_req_id;

  INSERT INTO system.alertas_enviados (
    bar_id, tipo, categoria, titulo, mensagem, dados, enviado_discord
  ) VALUES (
    COALESCE(p_bar_id, 3),
    COALESCE(p_tipo, 'info'),
    COALESCE(p_categoria, 'sistema'),
    p_titulo,
    p_mensagem,
    jsonb_build_object('dedupe_key', v_key, 'request_id', v_req_id, 'origem', 'sql_direct_discord'),
    (v_req_id IS NOT NULL)
  );

  RETURN 'ENVIADO key=' || v_key || ' request_id=' || COALESCE(v_req_id::text, 'null');
END;
$function$;

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
            PERFORM pg_sleep(15);

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
            PERFORM pg_sleep(10);

            SELECT r.status_code, r.content INTO v_status_proc, v_resp_msg
            FROM net._http_response r WHERE r.id = v_req_id_proc LIMIT 1;

            SELECT COUNT(*) INTO v_count_silver_apos
            FROM silver.silver_contahub_operacional_stockout_processado s2
            WHERE s2.bar_id = v_bar AND s2.data_consulta = v_data;

            EXIT WHEN v_count_silver_apos > 0 OR (v_status_proc IS NOT NULL AND v_status_proc != 200);

            IF v_count_silver_apos = 0 AND v_tentativas < 2 THEN
              RAISE NOTICE 'Bar % - retry % (status=%): %', v_bar, v_tentativas, v_status_proc, LEFT(COALESCE(v_resp_msg, 'null'), 200);
              PERFORM pg_sleep(5);
            END IF;
          END LOOP;

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
