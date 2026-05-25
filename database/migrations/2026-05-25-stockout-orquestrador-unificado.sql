-- Stockout: unificar sync + processar + auditoria em um orquestrador único
-- ============================================================================
-- Contexto (descoberto em 2026-05-25):
-- 1. Silver de 14/05 a 23/05 ficou todo vazio (10 dias) porque o cron de coleta
--    rodava CURRENT_DATE mas a coleta tardia (origem desconhecida) populava
--    bronze de D-1 às 17h do dia seguinte. O retry de processamento (16h)
--    rodava 1h ANTES da coleta tardia.
-- 2. 6 crons diferentes pra stockout (sync ord, sync deb, processar ord,
--    processar deb, retry manhã, retry tarde). Race conditions e horários
--    descoordenados.
--
-- Solução (2026-05-25):
-- - 1 função SQL orquestradora `stockout_executar_completo(bar, data)`:
--     a) chama edge function `contahub-stockout-sync` (popular bronze)
--     b) espera 8s
--     c) chama edge function `stockout-processar` (popular silver)
--     d) espera 8s
--     e) loga execução em `silver.stockout_execucao_log`
--     f) retorna jsonb com resultado
-- - Crons consolidados (todos CURRENT_DATE, mesmo dia):
--     stockout-completo-ordinario   22:00 UTC (19:00 BRT) bar 3 todo dia
--     stockout-completo-deboche     22:10 UTC (19:10 BRT) bar 4 dom/ter-sab
--     stockout-retry-ordinario      01:00 UTC (22:00 BRT) bar 3 todo dia (se silver vazio)
--     stockout-retry-deboche        01:10 UTC (22:10 BRT) bar 4 dom/ter-sab (se silver vazio)
-- - Crons obsoletos REMOVIDOS:
--     402, 403, 404, 405, 352, 480
-- - Alerta jobid 312 mantido (mas movido pra 09:00 BRT — só alerta se a
--   noite anterior não populou silver).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Tabela de log de execução
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS silver.stockout_execucao_log (
  id              BIGSERIAL PRIMARY KEY,
  bar_id          INTEGER NOT NULL,
  data_consulta   DATE NOT NULL,
  executado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by    TEXT NOT NULL,
  status          TEXT NOT NULL,
  sync_status     INTEGER,
  sync_req_id     BIGINT,
  proc_status     INTEGER,
  proc_req_id     BIGINT,
  bronze_linhas   INTEGER,
  silver_linhas   INTEGER,
  incluidos       INTEGER,
  excluidos       INTEGER,
  percentual_stockout NUMERIC(6,2),
  tempo_total_ms  INTEGER,
  versao_regras   TEXT,
  erro_msg        TEXT
);

CREATE INDEX IF NOT EXISTS idx_stockout_exec_log_bar_data
  ON silver.stockout_execucao_log (bar_id, data_consulta DESC, executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_stockout_exec_log_recent
  ON silver.stockout_execucao_log (executado_em DESC);

COMMENT ON TABLE silver.stockout_execucao_log IS
  'Log de toda execução de stockout (sync+processar). Uma linha por chamada da função stockout_executar_completo. Histórico permanente — não deletar.';

-- View pra public (PostgREST acessar)
CREATE OR REPLACE VIEW public.stockout_execucao_log AS
  SELECT * FROM silver.stockout_execucao_log;

-- ----------------------------------------------------------------------------
-- 2) Função orquestradora
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stockout_executar_completo(
  p_bar_id integer,
  p_data_date date DEFAULT CURRENT_DATE,
  p_triggered_by text DEFAULT 'manual'
) RETURNS jsonb
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
BEGIN
  SET LOCAL statement_timeout = '5min';

  -- Bar opera no dia?
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
    -- Etapa 1: sync bronze
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

    PERFORM pg_sleep(10);

    SELECT r.status_code INTO v_sync_status
    FROM net._http_response r WHERE r.id = v_sync_req_id LIMIT 1;

    SELECT COUNT(*) INTO v_bronze_count
    FROM bronze.bronze_contahub_operacional_stockout_raw
    WHERE bar_id = p_bar_id AND data_consulta = p_data_date;

    IF v_bronze_count = 0 THEN
      v_status := 'erro_sync_vazio';
      RAISE EXCEPTION 'Bronze permaneceu vazio após sync (status=%, req=%)', v_sync_status, v_sync_req_id;
    END IF;

    -- Etapa 2: processar silver
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

    PERFORM pg_sleep(8);

    SELECT r.status_code INTO v_proc_status
    FROM net._http_response r WHERE r.id = v_proc_req_id LIMIT 1;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE incluido), COUNT(*) FILTER (WHERE NOT incluido),
           MAX(versao_regras)
    INTO v_silver_count, v_incluidos, v_excluidos, v_versao
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id AND data_consulta = p_data_date;

    IF v_silver_count = 0 THEN
      v_status := 'erro_silver_vazio';
      RAISE EXCEPTION 'Silver permaneceu vazio apos processar (status=%, req=%)', v_proc_status, v_proc_req_id;
    END IF;

    -- Percentual de stockout: dos produtos incluidos, quantos estavam inativos/sem venda
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
    'status', v_status,
    'bar_id', p_bar_id,
    'data', p_data_date,
    'bronze_linhas', v_bronze_count,
    'silver_linhas', v_silver_count,
    'incluidos', v_incluidos,
    'excluidos', v_excluidos,
    'percentual_stockout', v_percent,
    'tempo_ms', v_tempo_ms,
    'erro', v_erro
  );
END;
$function$;

COMMENT ON FUNCTION public.stockout_executar_completo(integer, date, text) IS
  'Orquestrador único de stockout: sync + processar + log em uma chamada. Substitui as 4 funções/crons anteriores (sync ord, sync deb, processar ord, processar deb).';

-- ----------------------------------------------------------------------------
-- 3) Remover crons obsoletos
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_obsoletos text[] := ARRAY[
    'stockout-processar-auto-ordinario',
    'stockout-processar-auto-deboche',
    'stockout-sync-diario-correto-v2',
    'stockout-sync-diario-deboche',
    'stockout-retry-d-1-ambos-v2',
    'stockout-retry-d-1-tarde'
  ];
  v_nome text;
  v_id integer;
BEGIN
  FOREACH v_nome IN ARRAY v_obsoletos LOOP
    SELECT jobid INTO v_id FROM cron.job WHERE jobname = v_nome;
    IF v_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_id);
      RAISE NOTICE 'Removido cron %', v_nome;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4) Novos crons consolidados (CURRENT_DATE, mesmo dia)
-- ----------------------------------------------------------------------------
-- Bar 3 (Ordinario) - todo dia 19:00 BRT (22:00 UTC)
SELECT cron.schedule(
  'stockout-completo-ordinario',
  '0 22 * * *',
  $$ SELECT public.stockout_executar_completo(3, CURRENT_DATE, 'cron-noite'); $$
);

-- Bar 4 (Deboche) - todo dia exceto segunda 19:10 BRT (22:10 UTC)
SELECT cron.schedule(
  'stockout-completo-deboche',
  '10 22 * * 0,2,3,4,5,6',
  $$ SELECT public.stockout_executar_completo(4, CURRENT_DATE, 'cron-noite'); $$
);

-- Retry tarde (22:00 BRT = 01:00 UTC do dia seguinte) - so' se silver vazio
CREATE OR REPLACE FUNCTION public.stockout_retry_se_vazio(p_bar_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'silver', 'operations', 'pg_catalog'
AS $function$
DECLARE
  v_count integer;
  v_data date := CURRENT_DATE;
BEGIN
  -- Considera o "dia operacional" - se executando 01:00 UTC (22:00 BRT do dia anterior em BRT),
  -- a data_consulta de interesse e CURRENT_DATE - 1 (BRT)
  v_data := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT COUNT(*) INTO v_count
  FROM silver.silver_contahub_operacional_stockout_processado
  WHERE bar_id = p_bar_id AND data_consulta = v_data;

  IF v_count > 0 THEN
    RETURN jsonb_build_object('status', 'ok_ja_existe', 'bar_id', p_bar_id, 'data', v_data, 'linhas', v_count);
  END IF;

  RETURN public.stockout_executar_completo(p_bar_id, v_data, 'cron-retry-noite');
END;
$function$;

SELECT cron.schedule(
  'stockout-retry-ordinario',
  '0 1 * * *',
  $$ SELECT public.stockout_retry_se_vazio(3); $$
);

SELECT cron.schedule(
  'stockout-retry-deboche',
  '10 1 * * 1,3,4,5,6,0',
  $$ SELECT public.stockout_retry_se_vazio(4); $$
);

-- ----------------------------------------------------------------------------
-- 5) Mover alerta de faltante para 09:00 BRT (12:00 UTC) - após retry
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_id integer;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'alerta-stockout-faltante-ontem';
  IF v_id IS NOT NULL THEN
    PERFORM cron.alter_job(v_id, schedule := '0 12 * * *');
  END IF;
END $$;

COMMIT;
