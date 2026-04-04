-- ============================================================================
-- FIX: CONTAHUB PAGAMENTOS - USAR UPSERT EM VEZ DE INSERT
-- ============================================================================

-- PASSO 1: Limpar duplicatas existentes
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY bar_id, vd, pag, trn, dt_gerencial 
           ORDER BY created_at DESC
         ) as rn
  FROM contahub_pagamentos
)
DELETE FROM contahub_pagamentos
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- PASSO 2: Adicionar constraint de unicidade
ALTER TABLE contahub_pagamentos 
DROP CONSTRAINT IF EXISTS contahub_pagamentos_unique_key;

ALTER TABLE contahub_pagamentos 
ADD CONSTRAINT contahub_pagamentos_unique_key 
UNIQUE (bar_id, vd, pag, trn, dt_gerencial);

-- PASSO 3: Modificar função para usar UPSERT
CREATE OR REPLACE FUNCTION public.process_pagamentos_data(
  p_bar_id integer, 
  p_data_array jsonb, 
  p_data_date date
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
    item_json jsonb;
    upserted_count integer := 0;
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
            COALESCE(item_json->>''vd'', ''''),
            COALESCE(item_json->>''trn'', ''''),
            COALESCE((item_json->>''dt_gerencial'')::date, p_data_date),
            COALESCE(item_json->>''hr_lancamento'', ''''),
            COALESCE(item_json->>''hr_transacao'', ''''),
            COALESCE((item_json->>''dt_transacao'')::date, NULL),
            COALESCE(item_json->>''mesa'', ''''),
            COALESCE((item_json->>''cli'')::integer, 0),
            COALESCE(item_json->>''cliente'', ''''),
            COALESCE((item_json->>''$vr_pagamentos'')::numeric, 0),
            COALESCE(item_json->>''pag'', ''''),
            COALESCE((item_json->>''$valor'')::numeric, 0),
            COALESCE((item_json->>''taxa'')::numeric, 0),
            COALESCE((item_json->>''perc'')::numeric, 0),
            COALESCE((item_json->>''$liquido'')::numeric, 0),
            COALESCE(item_json->>''tipo'', ''''),
            COALESCE(item_json->>''meio'', ''''),
            COALESCE(item_json->>''cartao'', ''''),
            COALESCE(item_json->>''autorizacao'', ''''),
            COALESCE((item_json->>''dt_credito'')::date, NULL),
            COALESCE(item_json->>''usr_abriu'', ''''),
            COALESCE(item_json->>''usr_lancou'', ''''),
            COALESCE(item_json->>''usr_aceitou'', ''''),
            COALESCE(item_json->>''motivodesconto'', '''')
        )
        ON CONFLICT (bar_id, vd, pag, trn, dt_gerencial) 
        DO UPDATE SET
            hr_lancamento = EXCLUDED.hr_lancamento,
            hr_transacao = EXCLUDED.hr_transacao,
            dt_transacao = EXCLUDED.dt_transacao,
            mesa = EXCLUDED.mesa,
            cli = EXCLUDED.cli,
            cliente = EXCLUDED.cliente,
            vr_pagamentos = EXCLUDED.vr_pagamentos,
            valor = EXCLUDED.valor,
            taxa = EXCLUDED.taxa,
            perc = EXCLUDED.perc,
            liquido = EXCLUDED.liquido,
            tipo = EXCLUDED.tipo,
            meio = EXCLUDED.meio,
            cartao = EXCLUDED.cartao,
            autorizacao = EXCLUDED.autorizacao,
            dt_credito = EXCLUDED.dt_credito,
            usr_abriu = EXCLUDED.usr_abriu,
            usr_lancou = EXCLUDED.usr_lancou,
            usr_aceitou = EXCLUDED.usr_aceitou,
            motivodesconto = EXCLUDED.motivodesconto,
            updated_at = NOW();
            
        upserted_count := upserted_count + 1;
    END LOOP;
    
    PERFORM adapter_contahub_to_faturamento_pagamentos(p_bar_id, p_data_date);
    
    RETURN upserted_count;
END;
$function$;
