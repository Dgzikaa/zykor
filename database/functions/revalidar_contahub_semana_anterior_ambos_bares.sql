-- Função: revalidar_contahub_semana_anterior_ambos_bares
CREATE OR REPLACE FUNCTION public.revalidar_contahub_semana_anterior_ambos_bares()
 RETURNS TABLE(data_evento date, bar_id integer, sync_status integer, process_status integer, eventos_recalculados integer)
 LANGUAGE plpgsql
AS $$
DECLARE v_data date; v_bar integer; v_sync_status integer; v_proc_status integer; v_recalc_count integer; r_evento record;
BEGIN
FOR v_data IN SELECT d::date FROM generate_series(current_date - interval '7 day', current_date - interval '1 day', interval '1 day') d ORDER BY d LOOP
  FOREACH v_bar IN ARRAY ARRAY[3,4] LOOP
    v_sync_status := NULL; v_proc_status := NULL; v_recalc_count := 0;
    BEGIN
      PERFORM update_eventos_base_from_contahub_batch(v_data, v_bar);
    EXCEPTION WHEN OTHERS THEN NULL; END;
    FOR r_evento IN SELECT id FROM eventos_base WHERE bar_id = v_bar AND data_evento = v_data AND ativo = true LOOP
      BEGIN PERFORM calculate_evento_metrics(r_evento.id); v_recalc_count := v_recalc_count + 1; EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
    data_evento := v_data; bar_id := v_bar; sync_status := v_sync_status; process_status := v_proc_status; eventos_recalculados := v_recalc_count;
    RETURN NEXT;
    PERFORM pg_sleep(1);
  END LOOP;
END LOOP;
END; $$;
