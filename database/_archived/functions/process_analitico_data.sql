-- Function: process_analitico_data
-- Exportado de produção em: 2026-03-19
-- Descrição: Processa dados analíticos do ContaHub (inserção em contahub_analitico)
-- Usado por: contahub-sync-automatico

CREATE OR REPLACE FUNCTION public.process_analitico_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
BEGIN
    -- Inserir novos dados
    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO contahub_analitico (
            bar_id, vd_mesadesc, vd_localizacao, itm, trn, trn_desc,
            prefixo, tipo, tipovenda, ano, mes, trn_dtgerencial,
            usr_lancou, prd, prd_desc, grp_desc, loc_desc, qtd,
            desconto, valorfinal, custo, itm_obs, comandaorigem,
            itemorigem
        ) VALUES (
            p_bar_id,
            COALESCE(item_json->>'vd_mesadesc', ''),
            COALESCE(item_json->>'vd_localizacao', ''),
            COALESCE((item_json->>'itm')::integer, 0),
            COALESCE((item_json->>'trn')::integer, 0),
            COALESCE(item_json->>'trn_desc', ''),
            COALESCE(item_json->>'prefixo', ''),
            COALESCE(item_json->>'tipo', ''),
            COALESCE(item_json->>'tipovenda', ''),
            COALESCE((item_json->>'ano')::integer, EXTRACT(YEAR FROM p_data_date)),
            COALESCE((SUBSTRING(item_json->>'mes', 6, 2))::integer, EXTRACT(MONTH FROM p_data_date)),
            COALESCE((item_json->>'trn_dtgerencial')::date, p_data_date),
            COALESCE(item_json->>'usr_lancou', ''),
            COALESCE(item_json->>'prd', ''),
            COALESCE(item_json->>'prd_desc', ''),
            COALESCE(item_json->>'grp_desc', ''),
            COALESCE(item_json->>'loc_desc', ''),
            COALESCE((item_json->>'qtd')::numeric, 0),
            COALESCE((item_json->>'desconto')::numeric, 0),
            COALESCE((item_json->>'valorfinal')::numeric, 0),
            COALESCE((item_json->>'custo')::numeric, 0),
            COALESCE(item_json->>'itm_obs', ''),
            COALESCE(item_json->>'comandaorigem', ''),
            COALESCE(item_json->>'itemorigem', '')
        );
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$function$;
