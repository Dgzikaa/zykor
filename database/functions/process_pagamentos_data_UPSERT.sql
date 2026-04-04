CREATE OR REPLACE FUNCTION public.process_pagamentos_data(
  p_bar_id integer, 
  p_data_array jsonb, 
  p_data_date date
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO ''public''
AS `$function`$
DECLARE
    item_json jsonb;
    upserted_count integer := 0;
    v_vd text;
    v_pag text;
    v_trn text;
    v_dt_gerencial date;
    existing_id integer;
BEGIN
    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        v_vd := COALESCE(item_json->>''vd'', '''');
        v_pag := COALESCE(item_json->>''pag'', '''');
        v_trn := COALESCE(item_json->>''trn'', '''');
        v_dt_gerencial := COALESCE((item_json->>''dt_gerencial'')::date, p_data_date);
        
        SELECT id INTO existing_id 
        FROM contahub_pagamentos 
        WHERE bar_id = p_bar_id 
          AND vd = v_vd 
          AND pag = v_pag 
          AND trn = v_trn 
          AND dt_gerencial = v_dt_gerencial 
        LIMIT 1;
        
        IF existing_id IS NOT NULL THEN
            UPDATE contahub_pagamentos SET
                hr_lancamento = COALESCE(item_json->>''hr_lancamento'', ''''),
                hr_transacao = COALESCE(item_json->>''hr_transacao'', ''''),
                dt_transacao = COALESCE((item_json->>''dt_transacao'')::date, NULL),
                mesa = COALESCE(item_json->>''mesa'', ''''),
                cli = COALESCE((item_json->>''cli'')::integer, 0),
                cliente = COALESCE(item_json->>''cliente'', ''''),
                vr_pagamentos = COALESCE((item_json->>''`$vr_pagamentos'')::numeric, 0),
                valor = COALESCE((item_json->>''`$valor'')::numeric, 0),
                taxa = COALESCE((item_json->>''taxa'')::numeric, 0),
                perc = COALESCE((item_json->>''perc'')::numeric, 0),
                liquido = COALESCE((item_json->>''`$liquido'')::numeric, 0),
                tipo = COALESCE(item_json->>''tipo'', ''''),
                meio = COALESCE(item_json->>''meio'', ''''),
                cartao = COALESCE(item_json->>''cartao'', ''''),
                autorizacao = COALESCE(item_json->>''autorizacao'', ''''),
                dt_credito = COALESCE((item_json->>''dt_credito'')::date, NULL),
                usr_abriu = COALESCE(item_json->>''usr_abriu'', ''''),
                usr_lancou = COALESCE(item_json->>''usr_lancou'', ''''),
                usr_aceitou = COALESCE(item_json->>''usr_aceitou'', ''''),
                motivodesconto = COALESCE(item_json->>''motivodesconto'', ''''),
                updated_at = NOW()
            WHERE id = existing_id;
        ELSE
            INSERT INTO contahub_pagamentos (
                bar_id, vd, trn, dt_gerencial, hr_lancamento, hr_transacao,
                dt_transacao, mesa, cli, cliente, vr_pagamentos, pag,
                valor, taxa, perc, liquido, tipo, meio, cartao, 
                autorizacao, dt_credito, usr_abriu, usr_lancou, 
                usr_aceitou, motivodesconto
            ) VALUES (
                p_bar_id, v_vd, v_trn, v_dt_gerencial,
                COALESCE(item_json->>''hr_lancamento'', ''''),
                COALESCE(item_json->>''hr_transacao'', ''''),
                COALESCE((item_json->>''dt_transacao'')::date, NULL),
                COALESCE(item_json->>''mesa'', ''''),
                COALESCE((item_json->>''cli'')::integer, 0),
                COALESCE(item_json->>''cliente'', ''''),
                COALESCE((item_json->>''`$vr_pagamentos'')::numeric, 0),
                v_pag,
                COALESCE((item_json->>''`$valor'')::numeric, 0),
                COALESCE((item_json->>''taxa'')::numeric, 0),
                COALESCE((item_json->>''perc'')::numeric, 0),
                COALESCE((item_json->>''`$liquido'')::numeric, 0),
                COALESCE(item_json->>''tipo'', ''''),
                COALESCE(item_json->>''meio'', ''''),
                COALESCE(item_json->>''cartao'', ''''),
                COALESCE(item_json->>''autorizacao'', ''''),
                COALESCE((item_json->>''dt_credito'')::date, NULL),
                COALESCE(item_json->>''usr_abriu'', ''''),
                COALESCE(item_json->>''usr_lancou'', ''''),
                COALESCE(item_json->>''usr_aceitou'', ''''),
                COALESCE(item_json->>''motivodesconto'', '''')
            );
        END IF;
        
        upserted_count := upserted_count + 1;
    END LOOP;
    
    PERFORM adapter_contahub_to_faturamento_pagamentos(p_bar_id, p_data_date);
    
    RETURN upserted_count;
END;
`$function`$;
