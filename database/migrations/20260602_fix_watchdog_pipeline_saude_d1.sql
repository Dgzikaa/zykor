-- 20260602_fix_watchdog_pipeline_saude_d1.sql
--
-- O watchdog public.verificar_saude_pipeline_d1_alerta_discord (cron 313, 10:50)
-- estava ELE MESMO quebrado: referenciava contahub_raw_data e contahub_stockout,
-- tabelas que NAO existem mais (movidas/renomeadas no v4.0 -> bronze.bronze_contahub_*).
-- Resultado: o vigia que deveria pegar falha silenciosa falhava silenciosamente a
-- cada execucao -> nunca alertou -> o backlog de recalculo (bug do Yuzer) ficou
-- invisivel por meses.
--
-- FIX:
--   1. Qualifica raw -> bronze.bronze_contahub_raw_data (colunas conferidas).
--   2. Remove o check de stockout (referenciava tabela morta E e redundante com o
--      cron 312 'alerta-stockout-faltante-ontem').
--   3. Mantem o check de recalculo pendente D-1 e ADICIONA deteccao de BACKLOG
--      ACUMULADO (precisa_recalculo=true em datas anteriores a ontem) — o ponto cego
--      que deixou o problema escondido. Qualifica eventos_base -> operations.

CREATE OR REPLACE FUNCTION public.verificar_saude_pipeline_d1_alerta_discord() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_data date := (current_date - interval '1 day')::date; v_msg text := ''; v_raw_count int; v_pendentes_count int; v_backlog_count int; v_backlog_min date; v_bar int;
BEGIN
  FOR v_bar IN SELECT unnest(ARRAY[3,4]) LOOP
    SELECT COUNT(DISTINCT data_type) INTO v_raw_count FROM bronze.bronze_contahub_raw_data
      WHERE bar_id = v_bar AND data_date = v_data AND processed = true
        AND data_type IN ('analitico','fatporhora','pagamentos','periodo','tempo');
    IF COALESCE(v_raw_count,0) < 5 THEN v_msg := v_msg || format('• Bar %s: raw ContaHub incompleto (%s/5 tipos) em %s.\n', v_bar, COALESCE(v_raw_count,0), v_data); END IF;
    SELECT COUNT(*) INTO v_pendentes_count FROM operations.eventos_base WHERE bar_id = v_bar AND data_evento = v_data AND ativo = true AND COALESCE(precisa_recalculo, false) = true;
    IF COALESCE(v_pendentes_count,0) > 0 THEN v_msg := v_msg || format('• Bar %s: %s evento(s) pendente(s) de recálculo em %s.\n', v_bar, v_pendentes_count, v_data); END IF;
    SELECT COUNT(*), MIN(data_evento) INTO v_backlog_count, v_backlog_min FROM operations.eventos_base WHERE bar_id = v_bar AND ativo = true AND COALESCE(precisa_recalculo, false) = true AND data_evento < v_data;
    IF COALESCE(v_backlog_count,0) > 0 THEN v_msg := v_msg || format('• Bar %s: %s evento(s) com recálculo TRAVADO (backlog; mais antigo: %s).\n', v_bar, v_backlog_count, v_backlog_min); END IF;
  END LOOP;
  IF v_msg <> '' THEN RETURN public.enviar_alerta_discord_sistema_dedup(3, 'erro', 'pipeline_saude', 'Alerta Saúde Pipeline D-1', 'Problemas D-1 (' || v_data::text || '):\n\n' || v_msg, 15158332, 'pipeline_saude_d1_' || v_data::text); END IF;
  RETURN 'OK_SEM_ALERTA';
END;
$$;
