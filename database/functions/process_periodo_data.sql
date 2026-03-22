-- Função: process_periodo_data
-- Processa dados de período do ContaHub e popula tabelas contahub_periodo e visitas
CREATE OR REPLACE FUNCTION public.process_periodo_data(
  p_bar_id integer, 
  p_data_array jsonb, 
  p_data_date date
) 
RETURNS integer 
LANGUAGE plpgsql 
SET search_path TO 'public'
AS $$
DECLARE 
  item_json jsonb; 
  inserted_count integer := 0;
BEGIN
    -- Inserir novos dados em contahub_periodo
    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        INSERT INTO contahub_periodo (
            bar_id, vd_mesadesc, vd_localizacao, vd_dtcontabil, dt_gerencial, 
            usr_abriu, tipovenda, pessoas, qtd_itens, vr_produtos, 
            vr_couvert, vr_desconto, vr_pagamentos, vr_repique, 
            ultimo_pedido, motivo, cli_nome, cli_email, cli_fone, cli_dtnasc, 
            cht_nome, semana
        )
        VALUES (
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
    
    -- =====================================================
    -- FASE 3: Popular tabela visitas automaticamente
    -- Usa UPSERT para manter idempotencia
    -- =====================================================
    PERFORM adapter_contahub_to_visitas(p_bar_id, p_data_date);
    
    RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION process_periodo_data(INTEGER, JSONB, DATE) IS 'Processa dados de periodo do ContaHub e popula tabelas contahub_periodo e visitas';
