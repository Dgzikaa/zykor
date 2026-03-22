-- Function: process_periodo_data
-- Exportado de produção em: 2026-03-19
-- Descrição: Processa dados de período do ContaHub (inserção em contahub_periodo)
-- Usado por: contahub-sync-automatico

CREATE OR REPLACE FUNCTION public.process_periodo_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
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
        INSERT INTO contahub_periodo (
            bar_id, vd_mesadesc, vd_localizacao, vd_dtcontabil, dt_gerencial,
            usr_abriu, tipovenda, pessoas, qtd_itens, vr_produtos,
            vr_couvert, vr_desconto, vr_pagamentos, vr_repique,
            ultimo_pedido, motivo, cli_nome, cli_email, cli_fone, cli_dtnasc,
            cht_nome, semana
        ) VALUES (
            p_bar_id,
            COALESCE(item_json->>'vd_mesadesc', ''),
            COALESCE(item_json->>'vd_localizacao', ''),
            COALESCE((item_json->>'vd_dtcontabil')::date, p_data_date),
            COALESCE((item_json->>'dt_gerencial')::date, p_data_date),
            COALESCE(item_json->>'usr_abriu', ''),
            COALESCE(item_json->>'tipovenda', ''),
            COALESCE((item_json->>'pessoas')::numeric, 0),
            COALESCE((item_json->>'qtd_itens')::numeric, 0),
            COALESCE((item_json->>'$vr_produtos')::numeric, 0),
            COALESCE((item_json->>'$vr_couvert')::numeric, 0),
            COALESCE((item_json->>'vr_desconto')::numeric, 0),
            COALESCE((item_json->>'$vr_pagamentos')::numeric, 0),
            COALESCE((item_json->>'$vr_repique')::numeric, 0),
            COALESCE(item_json->>'ultimo_pedido', ''),
            COALESCE(item_json->>'motivo', ''),
            COALESCE(item_json->>'cli_nome', ''),
            COALESCE(item_json->>'cli_email', ''),
            COALESCE(item_json->>'cli_fone', ''),
            COALESCE((item_json->>'cli_dtnasc')::date, NULL),
            COALESCE(item_json->>'cht_nome', ''),
            EXTRACT(WEEK FROM p_data_date)
        );
        inserted_count := inserted_count + 1;
    END LOOP;
    
    RETURN inserted_count;
END;
$function$;
