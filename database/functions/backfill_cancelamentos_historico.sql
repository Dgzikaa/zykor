-- Função: backfill_cancelamentos_historico
CREATE OR REPLACE FUNCTION public.backfill_cancelamentos_historico() RETURNS jsonb LANGUAGE plpgsql
AS $$
DECLARE v_bar_id INTEGER; v_data DATE; v_raw_record RECORD; v_item JSONB; v_total_processados INTEGER := 0; v_total_inseridos INTEGER := 0;
BEGIN
  FOR v_bar_id IN SELECT unnest(ARRAY[3, 4]) LOOP
    FOR v_raw_record IN SELECT data_date, raw_json FROM contahub_raw_data WHERE bar_id = v_bar_id AND data_type = 'cancelamentos' AND raw_json->'list' IS NOT NULL AND jsonb_array_length(raw_json->'list') > 0 ORDER BY data_date LOOP
      DELETE FROM contahub_cancelamentos WHERE bar_id = v_bar_id AND data = v_raw_record.data_date;
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_raw_record.raw_json->'list') LOOP
        INSERT INTO contahub_cancelamentos (bar_id, data, custototal, raw_data, created_at, updated_at) VALUES (v_bar_id, v_raw_record.data_date, COALESCE((v_item->>'custototal')::numeric, (v_item->>'custo_total')::numeric, 0), v_item, NOW(), NOW());
        v_total_inseridos := v_total_inseridos + 1;
      END LOOP;
      v_total_processados := v_total_processados + 1;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'dias_processados', v_total_processados, 'registros_inseridos', v_total_inseridos, 'timestamp', NOW());
END;
$$;
