-- Função: revalidar_stockout_dia_anterior_ambos_bares
CREATE OR REPLACE FUNCTION public.revalidar_stockout_dia_anterior_ambos_bares()
 RETURNS TABLE(bar_id integer, data_ref date, request_id bigint, status_code integer, timed_out boolean, error_msg text)
 LANGUAGE plpgsql
AS $$
DECLARE v_bar integer; v_data date := (current_date - interval '1 day')::date; v_req_id bigint; v_status integer; v_timeout boolean; v_error text;
BEGIN
FOREACH v_bar IN ARRAY ARRAY[3,4] LOOP
  v_req_id := NULL; v_status := NULL; v_timeout := NULL; v_error := NULL;
  BEGIN
    SELECT net.http_post(url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-stockout-sync', body := jsonb_build_object('bar_id', v_bar, 'data_date', v_data::text, 'source', 'pgcron-retry-d-1'), headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer [SERVICE_ROLE_KEY]'), timeout_milliseconds := 60000) INTO v_req_id;
    PERFORM pg_sleep(1);
    SELECT r.status_code, r.timed_out, r.error_msg INTO v_status, v_timeout, v_error FROM net._http_response r WHERE r.id = v_req_id LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  bar_id := v_bar; data_ref := v_data; request_id := v_req_id; status_code := v_status; timed_out := v_timeout; error_msg := v_error;
  RETURN NEXT;
END LOOP;
END; $$;
