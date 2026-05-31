-- ============================================================================
-- Stockout: corrigir captura que parou de rodar desde 25/05/2026
-- 2026-05-30  (aplicado em produção via MCP)
--
-- CAUSA RAIZ (confirmada ao vivo):
--   O orquestrador `stockout_executar_completo` (FUNCTION, criado em 25/05)
--   chamava net.http_post(edge) e logo entrava num loop pg_sleep pollando
--   net._http_response NA MESMA TRANSAÇÃO. O pg_net só ENVIA o request depois
--   do COMMIT — como a transação ficava presa 90s no polling, o request nunca
--   saía e a edge NUNCA executava (zero heartbeat, bronze vazio, sync_status
--   NULL -> "Bronze vazio"). Por isso 25-29/05 ficaram sem stockout.
--
-- TENTATIVA DESCARTADA: PROCEDURE com COMMIT entre os passos. Sob pg_cron dá
--   "ERROR: invalid transaction termination" (CALL não permite COMMIT aqui).
--
-- SOLUÇÃO FINAL (testada via pg_cron real): função "tick" fire-and-forget.
--   - Lê estado JÁ COMMITADO e dispara UM passo; nunca checa/poll depois do
--     http_post na mesma transação (a transação do job commita ao retornar,
--     e aí o pg_net envia).
--   - Captura só dispara se bronze vazio => preserva o snapshot já tirado
--     (stockout é point-in-time; não re-consulta o ContaHub fora da janela).
--   - Agendado em vários horários: 1º tick captura, tick seguinte processa;
--     ticks de retry à noite reprocessam/recapturam se faltou.
--   - Verificação + alerta Discord na MESMA noite (não só o D-1 das 09h).
-- ============================================================================

-- Limpar a tentativa com procedure
DROP PROCEDURE IF EXISTS public.stockout_executar_completo_v2(integer, date, text);
DROP PROCEDURE IF EXISTS public.stockout_retry_se_vazio_v2(integer);

-- ----------------------------------------------------------------------------
-- 1) Função tick (fire-and-forget, idempotente)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stockout_tick(p_bar_id integer, p_source text DEFAULT 'cron')
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'silver', 'bronze', 'operations', 'pg_catalog'
AS $fn$
DECLARE
  v_data   date := CURRENT_DATE;  -- DB tz = America/Sao_Paulo
  v_dia    integer := EXTRACT(DOW FROM CURRENT_DATE)::integer;
  v_opera  boolean := true;
  v_bronze integer; v_silver integer;
BEGIN
  SELECT CASE v_dia
    WHEN 0 THEN opera_domingo WHEN 1 THEN opera_segunda WHEN 2 THEN opera_terca
    WHEN 3 THEN opera_quarta  WHEN 4 THEN opera_quinta  WHEN 5 THEN opera_sexta
    WHEN 6 THEN opera_sabado END
  INTO v_opera FROM operations.bares_config WHERE bar_id = p_bar_id;
  IF NOT COALESCE(v_opera, true) THEN RETURN 'skip_fechado'; END IF;

  SELECT count(*) INTO v_silver
    FROM silver.silver_contahub_operacional_stockout_processado
    WHERE bar_id = p_bar_id AND data_consulta = v_data;
  IF v_silver > 0 THEN RETURN 'ja_ok'; END IF;

  SELECT count(*) INTO v_bronze
    FROM bronze.bronze_contahub_operacional_stockout_raw
    WHERE bar_id = p_bar_id AND data_consulta::date = v_data;

  IF v_bronze = 0 THEN
    PERFORM net.http_post(
      url := get_supabase_url() || '/functions/v1/contahub-stockout-sync',
      headers := jsonb_build_object('Authorization','Bearer '||get_service_role_key(),'Content-Type','application/json'),
      body := jsonb_build_object('bar_id',p_bar_id,'data_date',v_data::text,'source',p_source),
      timeout_milliseconds := 120000);
    RETURN 'captura_disparada';
  END IF;

  PERFORM net.http_post(
    url := get_supabase_url() || '/functions/v1/stockout-processar',
    headers := jsonb_build_object('Authorization','Bearer '||get_service_role_key(),'Content-Type','application/json'),
    body := jsonb_build_object('bar_id',p_bar_id,'data_date',v_data::text),
    timeout_milliseconds := 120000);
  RETURN 'processar_disparado';
END;
$fn$;

COMMENT ON FUNCTION public.stockout_tick(integer, text) IS
  'Tick idempotente de stockout (fire-and-forget). Cada tick avança 1 passo: captura (se bronze vazio) -> processa (se silver vazio). Sem COMMIT nem polling de net._http_response (anti-padrão que travava a edge).';

-- ----------------------------------------------------------------------------
-- 2) Verificação + alerta na MESMA noite
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stockout_verificar_e_alertar(p_data date DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'silver', 'operations', 'pg_catalog'
AS $fn$
DECLARE
  v_data date := COALESCE(p_data, CURRENT_DATE);
  v_bar integer; v_opera boolean; v_silver integer; v_falt text := '';
BEGIN
  FOREACH v_bar IN ARRAY ARRAY[3,4] LOOP
    SELECT CASE EXTRACT(DOW FROM v_data)::integer
      WHEN 0 THEN opera_domingo WHEN 1 THEN opera_segunda WHEN 2 THEN opera_terca
      WHEN 3 THEN opera_quarta  WHEN 4 THEN opera_quinta  WHEN 5 THEN opera_sexta
      WHEN 6 THEN opera_sabado END
    INTO v_opera FROM operations.bares_config WHERE bar_id = v_bar;
    IF NOT COALESCE(v_opera, true) THEN CONTINUE; END IF;

    SELECT count(*) INTO v_silver
      FROM silver.silver_contahub_operacional_stockout_processado
      WHERE bar_id = v_bar AND data_consulta = v_data;
    IF v_silver = 0 THEN v_falt := v_falt || v_bar::text || ', '; END IF;
  END LOOP;

  IF v_falt <> '' THEN
    PERFORM public.enviar_alerta_discord_sistema_dedup(
      3, 'erro', 'pipeline_saude',
      '🚨 Stockout ainda ausente (mesma noite)',
      'Stockout de '||v_data||' segue vazio para bar(es): '||rtrim(v_falt, ', ')||'. Captura noturna falhou.',
      15158332, 'stockout_falta_noite_'||v_data::text||'_'||rtrim(v_falt, ', '));
    RETURN 'alertado: '||rtrim(v_falt, ', ');
  END IF;
  RETURN 'ok';
END;
$fn$;

-- ----------------------------------------------------------------------------
-- 3) Crons (pg_cron usa UTC; BRT = UTC-3)
--    Captura 19:00/19:10 BRT, processa 19:07/19:17, retry 22:00.. , verifica 22:40
-- ----------------------------------------------------------------------------
SELECT cron.alter_job(481, command := $cmd$ SELECT public.stockout_tick(3, 'cron-noite'); $cmd$);   -- 19:00
SELECT cron.alter_job(482, command := $cmd$ SELECT public.stockout_tick(4, 'cron-noite'); $cmd$);   -- 19:10
SELECT cron.alter_job(483, command := $cmd$ SELECT public.stockout_tick(3, 'cron-retry'); $cmd$);   -- 22:00
SELECT cron.alter_job(484, command := $cmd$ SELECT public.stockout_tick(4, 'cron-retry'); $cmd$);   -- 22:10
SELECT cron.schedule('stockout-tick2-ord',       '7 22 * * *', $cmd$ SELECT public.stockout_tick(3, 'cron-noite-proc'); $cmd$);
SELECT cron.schedule('stockout-tick2-deb',       '17 22 * * *', $cmd$ SELECT public.stockout_tick(4, 'cron-noite-proc'); $cmd$);
SELECT cron.schedule('stockout-tick-retry2-ord', '7 1 * * *',  $cmd$ SELECT public.stockout_tick(3, 'cron-retry-proc'); $cmd$);
SELECT cron.schedule('stockout-tick-retry2-deb', '17 1 * * *', $cmd$ SELECT public.stockout_tick(4, 'cron-retry-proc'); $cmd$);
SELECT cron.schedule('stockout-verificar-noite', '40 1 * * *', $cmd$ SELECT public.stockout_verificar_e_alertar(CURRENT_DATE); $cmd$);
