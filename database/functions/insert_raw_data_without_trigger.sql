-- Função: insert_raw_data_without_trigger
CREATE OR REPLACE FUNCTION public.insert_raw_data_without_trigger(p_bar_id integer, p_data_date date, p_data_type text, p_processed boolean DEFAULT false, p_raw_json jsonb DEFAULT '{}'::jsonb) RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO contahub_raw_data (bar_id, data_type, data_date, raw_json, processed, created_at) VALUES (p_bar_id, p_data_type, p_data_date, p_raw_json, p_processed, NOW())
    ON CONFLICT (bar_id, data_type, data_date) DO UPDATE SET raw_json = EXCLUDED.raw_json, processed = EXCLUDED.processed, updated_at = NOW() RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;
