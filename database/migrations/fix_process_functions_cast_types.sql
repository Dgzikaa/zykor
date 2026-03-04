-- Corrigir tipos de dados nas funções process_tempo_data e process_fatporhora_data

-- 1. CORRIGIR process_fatporhora_data (hora precisa ser integer)
CREATE OR REPLACE FUNCTION public.process_fatporhora_data(
    p_bar_id integer, 
    p_data_array jsonb, 
    p_data_date date
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO contahub_fatporhora (
            bar_id, vd_dtgerencial, dds, dia, hora, qtd, valor
        ) VALUES (
            p_bar_id,
            COALESCE((item_json->>'vd_dtgerencial')::date, p_data_date),
            COALESCE((item_json->>'dds')::integer, 0),
            COALESCE(item_json->>'dia', ''),
            COALESCE((item_json->>'hora')::integer, 0),  -- CAST para integer
            COALESCE(ROUND((item_json->>'qtd')::numeric)::integer, 0),
            COALESCE((item_json->>'$alor')::numeric, 0)
        );
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$$;

-- 2. CORRIGIR process_tempo_data (prd precisa ser integer)
CREATE OR REPLACE FUNCTION public.process_tempo_data(
    p_bar_id integer, 
    p_data_array jsonb, 
    p_data_date date
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO contahub_tempo (
            bar_id, grp_desc, prd_desc, vd_mesadesc, vd_localizacao,
            itm, t0_lancamento, t1_prodini, t2_prodfim, t3_entrega,
            t0_t1, t0_t2, t0_t3, t1_t2, t1_t3, t2_t3,
            prd, loc_desc, usr_abriu, usr_lancou,
            usr_produziu, usr_entregou, prefixo, tipovenda,
            ano, mes, dia, dds, diadasemana, hora, itm_qtd
        ) VALUES (
            p_bar_id,
            COALESCE(item_json->>'grp_desc', ''),
            COALESCE(item_json->>'prd_desc', ''),
            COALESCE(item_json->>'vd_mesadesc', ''),
            COALESCE(item_json->>'vd_localizacao', ''),
            COALESCE(item_json->>'itm', ''),
            COALESCE((item_json->>'t0-lancamento')::timestamp, NOW()),
            COALESCE((item_json->>'t1-prodini')::timestamp, NULL),
            COALESCE((item_json->>'t2-prodfim')::timestamp, NULL),
            COALESCE((item_json->>'t3-entrega')::timestamp, NULL),
            COALESCE((item_json->>'t0-t1')::numeric, 0),
            COALESCE((item_json->>'t0-t2')::numeric, 0),
            COALESCE((item_json->>'t0-t3')::numeric, 0),
            COALESCE((item_json->>'t1-t2')::numeric, 0),
            COALESCE((item_json->>'t1-t3')::numeric, 0),
            COALESCE((item_json->>'t2-t3')::numeric, 0),
            COALESCE((item_json->>'prd')::integer, 0),  -- CAST para integer
            COALESCE(item_json->>'loc_desc', ''),
            COALESCE(item_json->>'usr_abriu', ''),
            COALESCE(item_json->>'usr_lancou', ''),
            COALESCE(item_json->>'usr_produziu', ''),
            COALESCE(item_json->>'usr_entregou', ''),
            COALESCE(item_json->>'prefixo', ''),
            COALESCE(item_json->>'tipovenda', ''),
            COALESCE((item_json->>'ano')::integer, 0),
            COALESCE((item_json->>'mes')::integer, 0),
            COALESCE((item_json->>'dia')::timestamp, NOW()),
            COALESCE((item_json->>'dds')::integer, 0),
            COALESCE(item_json->>'diadasemana', ''),
            COALESCE(item_json->>'hora', ''),
            COALESCE((item_json->>'itm_qtd')::integer, 0)
        );
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$$;
