CREATE OR REPLACE FUNCTION public.process_fatporhora_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
    hora_str text;
    hora_int integer;
BEGIN
    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        hora_str := item_json->>'hora';
        hora_int := CASE 
            WHEN hora_str IS NULL THEN 0
            WHEN hora_str ~ '^\d+:\d+$' THEN SPLIT_PART(hora_str, ':', 1)::integer
            ELSE COALESCE(hora_str::integer, 0)
        END;
        
        INSERT INTO contahub_fatporhora (
            bar_id, vd_dtgerencial, dds, dia, hora, qtd, valor
        ) VALUES (
            p_bar_id,
            COALESCE((item_json->>'vd_dtgerencial')::date, p_data_date),
            COALESCE((item_json->>'dds')::integer, 0),
            COALESCE(item_json->>'dia', ''),
            hora_int,
            COALESCE(ROUND((item_json->>'qtd')::numeric)::integer, 0),
            COALESCE((item_json->>'valor')::numeric, 0)
        );
        inserted_count := inserted_count + 1;
    END LOOP;
    
    -- Popula tabela de dominio faturamento_hora
    PERFORM adapter_contahub_to_faturamento_hora(p_bar_id, p_data_date);
    
    RETURN inserted_count;
END;
$function$;
