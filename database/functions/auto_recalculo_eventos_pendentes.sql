-- Função: auto_recalculo_eventos_pendentes
-- Descrição: Recalcula eventos marcados como pendentes
CREATE OR REPLACE FUNCTION public.auto_recalculo_eventos_pendentes(p_tipo_execucao text DEFAULT 'automatico')
 RETURNS TABLE(total_processados integer, total_sucesso integer, total_erros integer, tempo_execucao_segundos numeric, detalhes jsonb, log_id integer)
 LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE evento_record RECORD; start_time TIMESTAMP; end_time TIMESTAMP; v_total_processados INTEGER := 0; v_total_sucesso INTEGER := 0; v_total_erros INTEGER := 0; v_detalhes JSONB := '[]'::jsonb; v_erro_msg TEXT; v_log_id INTEGER;
BEGIN
  start_time := clock_timestamp();
  FOR evento_record IN SELECT id, nome, data_evento FROM eventos_base WHERE precisa_recalculo = TRUE ORDER BY data_evento DESC LIMIT 100 LOOP
    BEGIN v_total_processados := v_total_processados + 1; PERFORM calculate_evento_metrics(evento_record.id); v_total_sucesso := v_total_sucesso + 1;
    EXCEPTION WHEN OTHERS THEN v_total_erros := v_total_erros + 1; v_erro_msg := SQLERRM; END;
  END LOOP;
  end_time := clock_timestamp();
  INSERT INTO recalculo_eventos_log (tipo_execucao, total_processados, total_sucesso, total_erros, tempo_execucao_segundos, detalhes, observacoes)
  VALUES (p_tipo_execucao, v_total_processados, v_total_sucesso, v_total_erros, EXTRACT(EPOCH FROM (end_time - start_time))::NUMERIC, v_detalhes, CASE WHEN v_total_processados = 0 THEN 'Nenhum evento pendente' WHEN v_total_erros = 0 THEN 'Sucesso' ELSE format('%s erros', v_total_erros) END)
  RETURNING id INTO v_log_id;
  RETURN QUERY SELECT v_total_processados, v_total_sucesso, v_total_erros, EXTRACT(EPOCH FROM (end_time - start_time))::NUMERIC, v_detalhes, v_log_id;
END;
$$;
