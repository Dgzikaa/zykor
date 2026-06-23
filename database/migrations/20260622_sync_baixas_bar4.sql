-- Sync contínuo de baixas do ContaAzul para o BAR 4 (espelha o bar 3).
--
-- Contexto: o backfill histórico (baixas_backfill_bar4) drenou os ~42k antigos e
-- se autodesligou (self-unschedule ao zerar). Mas o bar 4 ficou SEM o sync
-- contínuo que o bar 3 tem — então baixas novas (data_pagamento) não eram mais
-- buscadas, e a DFC do bar 4 re-defasava silenciosamente (furo de centavos).
--
-- Fix: replica sync-baixas-bar3 + rechecar-baixas-recentes-bar3 para o bar 4,
-- escalonado (offset 2min no sync) p/ não bater junto e congestionar o pg_net.

-- A cada 5min: pede pra edge fn buscar data_pagamento das baixas pendentes do bar 4.
select cron.schedule('sync-baixas-bar4', '2-59/5 * * * *', $cmd$
  SELECT net.http_post(url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contaazul-baixas',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
    body := jsonb_build_object('bar_id',4,'modo','baixas','limit',5000), timeout_milliseconds := 350000);
$cmd$);

-- Diário 08:45: remarca os últimos 45 dias como pendentes p/ re-sincronizar
-- (uma baixa pode cair dias depois do lançamento).
select cron.schedule('rechecar-baixas-recentes-bar4', '45 8 * * *', $cmd$
  UPDATE bronze.bronze_contaazul_lancamentos
  SET baixas_synced_em = NULL
  WHERE bar_id=4 AND valor_pago>0 AND data_competencia >= current_date - 45;
$cmd$);
