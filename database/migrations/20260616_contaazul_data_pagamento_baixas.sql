-- 2026-06-16 — Preencher data_pagamento real dos lançamentos do Conta Azul.
--
-- Contexto: o endpoint de LISTA do CA (.../contas-a-pagar|receber/buscar) NÃO
-- retorna a data de pagamento — só vencimento/competência/status. Por isso
-- bronze.bronze_contaazul_lancamentos.data_pagamento estava 100% null. A data real
-- mora na BAIXA: GET /v1/financeiro/eventos-financeiros/parcelas/{id}/baixa (1
-- chamada por parcela; não há busca em lote).
--
-- Solução:
--  1. Edge function `contaazul-baixas` (backend/supabase/functions/contaazul-baixas):
--     seleciona parcelas pagas (valor_pago>0) sem data_pagamento e busca a baixa de
--     cada uma, gravando data_pagamento. Time-boxed (~350s) e resumível.
--  2. Cron a cada 10 min (backfill ~82k registros + manutenção contínua).
--  3. Trigger "sticky" pra o sync (contaazul-sync manda data_pagamento=null no upsert)
--     nunca apagar a data já preenchida.
--
-- A regra correta do Balanço "em aberto no dia 31" passa a ser:
--   data_competencia <= fim_mes AND data_pagamento > fim_mes
-- (antes usávamos data_vencimento como proxy). Ver get_balanco_ca e a memory
-- project_contaazul_data_pagamento_baixa.

-- 1. Trigger: data_pagamento nunca volta pra null uma vez preenchida.
CREATE OR REPLACE FUNCTION public.trg_preserve_data_pagamento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data_pagamento IS NULL AND OLD.data_pagamento IS NOT NULL THEN
    NEW.data_pagamento := OLD.data_pagamento;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS preserve_data_pagamento ON bronze.bronze_contaazul_lancamentos;
CREATE TRIGGER preserve_data_pagamento
  BEFORE UPDATE ON bronze.bronze_contaazul_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_preserve_data_pagamento();

-- 2. Cron que dispara a edge function pra bar 3 e 4.
CREATE OR REPLACE FUNCTION public.cron_contaazul_baixas()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM net.http_post(
    url := get_supabase_url() || '/functions/v1/contaazul-baixas',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || get_service_role_key()),
    body := jsonb_build_object('bar_id', 3, 'limit', 2000),
    timeout_milliseconds := 300000);
  PERFORM net.http_post(
    url := get_supabase_url() || '/functions/v1/contaazul-baixas',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || get_service_role_key()),
    body := jsonb_build_object('bar_id', 4, 'limit', 2000),
    timeout_milliseconds := 300000);
END; $$;

SELECT cron.schedule('contaazul-baixas-10min', '*/10 * * * *', $$SELECT public.cron_contaazul_baixas();$$);
