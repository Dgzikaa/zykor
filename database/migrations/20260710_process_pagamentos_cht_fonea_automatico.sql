-- ============================================================================
-- FIX (10/07/26): modelo cartão (cht_fonea/cht_nome) no caminho AUTOMÁTICO de pagamentos.
--
-- Contexto: em 06/07 o ContaHub (bar 3) mudou pra cartão e passou a mandar o cliente
-- em cht_fonea/cht_nome. Ontem (09/07) corrigimos o EDGE FUNCTION contahub-processor
-- e fizemos backfill manual 06-08/07 -> funcionaram. Mas o dia 09, processado sozinho
-- às 07:00, saiu no modelo antigo (0 cht_fonea, só 11 cli_fone) e o parceiro (GoBar)
-- recebeu só 11 registros do dia 09.
--
-- Causa raiz: o sync automático (contahub-sync-automatico) NÃO usa o edge function.
-- Ele chama a RPC processar_raw_data_pendente -> process_pagamentos_data (função de
-- BANCO), que só lia cli_fone/cli_nome e ignorava cht_fonea/cht_nome.
--
-- Fix: process_pagamentos_data passa a entender o modelo cartão sozinha, em cascata:
--   cli_fone = cli_fone antigo (se preenchido) -> normalizar(cht_fonea) -> ''
--   cliente  = cli_nome antigo (se preenchido) -> cht_nome -> ''
-- e grava cht_fonea/cht_nome crus. Cobre os dois modelos sem perder cliente.
--
-- Ver memory project_contahub_cht_fonea_modelo_cartao.
-- ============================================================================

-- Réplica EXATA de normalizarFoneCartao() do contahub-processor/index.ts.
-- "556191815680" (55 + DDD 61 + 91815680) -> "61-991815680".
-- Tira 55, separa DDD(2)+número, prepend "9" quando número tem 8 dígitos.
-- Devolve '' quando não bate no padrão (não polui cli_fone com lixo).
CREATE OR REPLACE FUNCTION public.normalizar_fone_cartao(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d   text;
  ddd text;
  num text;
BEGIN
  d := regexp_replace(COALESCE(raw, ''), '\D', '', 'g');
  IF d = '' THEN RETURN ''; END IF;
  IF length(d) >= 12 AND left(d, 2) = '55' THEN
    d := substr(d, 3);                    -- remove código do país
  END IF;
  IF length(d) < 10 OR length(d) > 11 THEN RETURN ''; END IF;  -- fora de DDD(2)+8/9
  ddd := substr(d, 1, 2);
  num := substr(d, 3);
  IF length(num) = 8 THEN num := '9' || num; END IF;           -- 9º dígito do celular
  IF length(num) <> 9 THEN RETURN ''; END IF;
  RETURN ddd || '-' || num;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_pagamentos_data(p_bar_id integer, p_data_array jsonb, p_data_date date)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'operations', 'financial', 'system', 'integrations', 'bronze', 'silver', 'gold', 'crm', 'ops', 'pg_catalog'
AS $function$
DECLARE
    item_json jsonb;
    inserted_count integer := 0;
    v_cli_fone text;
    v_cliente  text;
BEGIN
    PERFORM pg_advisory_xact_lock(p_bar_id::integer, EXTRACT(epoch FROM p_data_date)::integer);

    DELETE FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos
    WHERE bar_id = p_bar_id AND dt_gerencial = p_data_date;

    FOR item_json IN SELECT jsonb_array_elements(p_data_array) LOOP
        -- Modelo cartão (06/07/26+): telefone/nome vêm em cht_fonea/cht_nome.
        -- Fallback: usa cli_fone/cli_nome antigos; se vazios, o cht_* (normalizado).
        v_cli_fone := COALESCE(
            NULLIF(trim(item_json->>'cli_fone'), ''),
            NULLIF(public.normalizar_fone_cartao(item_json->>'cht_fonea'), ''),
            ''
        );
        v_cliente := COALESCE(
            NULLIF(item_json->>'cli_nome', ''),
            NULLIF(item_json->>'cht_nome', ''),
            ''
        );

        INSERT INTO bronze.bronze_contahub_financeiro_pagamentosrecebidos (
            bar_id, vd, trn, pag, pos, mesa, tipo, meio, cartao, autorizacao,
            motivodesconto, dt_gerencial, dt_transacao, hr_lancamento, hr_transacao,
            valor, liquido, vr_pagamentos, cli, cliente, cli_fone, cli_cpf,
            cht_fonea, cht_nome,
            usr_abriu, usr_lancou, usr_aceitou
        ) VALUES (
            p_bar_id,
            item_json->>'vd',
            item_json->>'trn',
            item_json->>'pag',
            NULLIF(item_json->>'pos', '')::integer,
            item_json->>'mesa',
            item_json->>'tipo',
            item_json->>'meio',
            item_json->>'cartao',
            item_json->>'autorizacao',
            item_json->>'motivodesconto',
            NULLIF(item_json->>'dt_gerencial', '')::date,
            NULLIF(item_json->>'dt_transacao', '')::date,
            item_json->>'hr_lancamento',
            item_json->>'hr_transacao',
            NULLIF(item_json->>'$valor', '')::numeric,
            NULLIF(item_json->>'$liquido', '')::numeric,
            NULLIF(item_json->>'$vr_pagamentos', '')::numeric,
            NULLIF(item_json->>'cli', '')::integer,
            v_cliente,
            v_cli_fone,
            item_json->>'cli_cpf',
            NULLIF(item_json->>'cht_fonea', ''),
            NULLIF(item_json->>'cht_nome', ''),
            item_json->>'usr_abriu',
            item_json->>'usr_lancou',
            item_json->>'usr_aceitou'
        );
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$function$;
