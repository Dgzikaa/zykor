CREATE OR REPLACE FUNCTION public.process_pagamentos_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO contahub_pagamentos (
            bar_id, vd, trn, dt_gerencial, hr_lancamento, hr_transacao,
            dt_transacao, mesa, cli, cliente, vr_pagamentos, pag,
            valor, taxa, perc, liquido, tipo, meio, cartao, 
            autorizacao, dt_credito, usr_abriu, usr_lancou, 
            usr_aceitou, motivodesconto
        ) VALUES (
            p_bar_id,
            COALESCE(item_json->>'vd', ''),
            COALESCE(item_json->>'trn', ''),
            COALESCE((item_json->>'dt_gerencial')::date, p_data_date),
            COALESCE(item_json->>'hr_lancamento', ''),
            COALESCE(item_json->>'hr_transacao', ''),
            COALESCE((item_json->>'dt_transacao')::date, NULL),
            COALESCE(item_json->>'mesa', ''),
            COALESCE((item_json->>'cli')::integer, 0),
            COALESCE(item_json->>'cliente', ''),
            COALESCE((item_json->>'$vr_pagamentos')::numeric, 0),
            COALESCE(item_json->>'pag', ''),
            COALESCE((item_json->>'$valor')::numeric, 0),
            COALESCE((item_json->>'taxa')::numeric, 0),
            COALESCE((item_json->>'perc')::numeric, 0),
            COALESCE((item_json->>'$liquido')::numeric, 0),
            COALESCE(item_json->>'tipo', ''),
            COALESCE(item_json->>'meio', ''),
            COALESCE(item_json->>'cartao', ''),
            COALESCE(item_json->>'autorizacao', ''),
            COALESCE((item_json->>'dt_credito')::date, NULL),
            COALESCE(item_json->>'usr_abriu', ''),
            COALESCE(item_json->>'usr_lancou', ''),
            COALESCE(item_json->>'usr_aceitou', ''),
            COALESCE(item_json->>'motivodesconto', '')
        );
        inserted_count := inserted_count + 1;
    END LOOP;
    
    -- Popula tabela de dominio faturamento_pagamentos
    PERFORM adapter_contahub_to_faturamento_pagamentos(p_bar_id, p_data_date);
    
    RETURN inserted_count;
END;
$function$;
