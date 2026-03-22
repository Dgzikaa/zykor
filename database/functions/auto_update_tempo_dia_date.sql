-- Função: auto_update_tempo_dia_date
CREATE OR REPLACE FUNCTION public.auto_update_tempo_dia_date() RETURNS text LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE batch_start INTEGER; batch_end INTEGER; batch_size INTEGER := 100; total_updated INTEGER := 0;
BEGIN
    SELECT MIN(id) INTO batch_start FROM contahub_tempo WHERE dia IS NOT NULL AND dia_date IS NULL;
    IF batch_start IS NULL THEN RETURN 'Todos os registros já foram atualizados!'; END IF;
    batch_end := batch_start + batch_size - 1;
    UPDATE contahub_tempo SET dia_date = TO_DATE(dia::text, 'YYYYMMDD'), semana = EXTRACT(WEEK FROM TO_DATE(dia::text, 'YYYYMMDD')) WHERE dia IS NOT NULL AND dia_date IS NULL AND id BETWEEN batch_start AND batch_end;
    GET DIAGNOSTICS total_updated = ROW_COUNT;
    RETURN 'Processados ' || total_updated || ' registros (IDs ' || batch_start || '-' || batch_end || ')';
END;
$$;
