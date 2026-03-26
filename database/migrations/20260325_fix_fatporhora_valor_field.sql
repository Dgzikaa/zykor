-- =============================================================================
-- FIX: process_fatporhora_data lendo 'valor' em vez de '$valor'
-- O campo do JSON do ContaHub é '$valor' (com cifrão), não 'valor'
-- Isso causava fat_19h = 0 para todos os dias, resultando em %Fat 19h incorreto
-- =============================================================================

-- 1. Corrigir a função
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
            COALESCE((item_json->>'$valor')::numeric, 0)
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    -- Popula tabela de dominio faturamento_hora
    PERFORM adapter_contahub_to_faturamento_hora(p_bar_id, p_data_date);

    RETURN inserted_count;
END;
$function$;

-- 2. Reprocessar dados afetados: de 19/03/2026 em diante, usando o JSON bruto salvo
-- Para cada dia com valor=0 em contahub_fatporhora, reprocessar do raw_json
DO $$
DECLARE
    r RECORD;
    raw_data jsonb;
    list_data jsonb;
    reprocessed integer := 0;
BEGIN
    -- Buscar dias com dados em contahub_raw_data que têm valor=0 em contahub_fatporhora
    FOR r IN
        SELECT DISTINCT crd.data_date, crd.bar_id, crd.raw_json
        FROM contahub_raw_data crd
        WHERE crd.data_type = 'fatporhora'
          AND crd.data_date >= '2026-03-19'
          AND EXISTS (
              SELECT 1 FROM contahub_fatporhora cf
              WHERE cf.bar_id = crd.bar_id
                AND cf.vd_dtgerencial = crd.data_date
                AND cf.valor = 0
          )
        ORDER BY crd.data_date
    LOOP
        -- Extrair lista do JSON (pode ser {list: [...]} ou array direto)
        raw_data := r.raw_json;

        IF raw_data ? 'list' THEN
            list_data := raw_data->'list';
        ELSIF jsonb_typeof(raw_data) = 'array' THEN
            -- Pode ser array de objetos com .list
            IF (raw_data->0) ? 'list' THEN
                list_data := raw_data->0->'list';
            ELSE
                list_data := raw_data;
            END IF;
        ELSE
            list_data := '[]'::jsonb;
        END IF;

        IF jsonb_array_length(list_data) > 0 THEN
            -- Limpar dados antigos (com valor=0)
            DELETE FROM contahub_fatporhora
            WHERE bar_id = r.bar_id AND vd_dtgerencial = r.data_date;

            -- Reprocessar com a função corrigida
            PERFORM process_fatporhora_data(r.bar_id, list_data, r.data_date);
            reprocessed := reprocessed + 1;

            RAISE NOTICE 'Reprocessado: bar_id=%, data=%', r.bar_id, r.data_date;
        END IF;
    END LOOP;

    RAISE NOTICE 'Total dias reprocessados: %', reprocessed;
END;
$$;
