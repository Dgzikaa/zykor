-- Backfill TEMPORARIO das baixas do bar 4 (Deboche) — base do DFC e da conciliacao.
-- Contexto: o bar 4 ja tinha 40k data_pagamento preenchidos (endpoint de baixa do CA
-- funciona pro Deboche, token ok), mas a tabela bronze_contaazul_baixas (com
-- id_reconciliacao) nunca foi populada porque o modo='baixas' nunca rodou pro bar 4.
-- Esta funcao drena a fila (baixas_synced_em IS NULL) em lotes via edge contaazul-baixas
-- e se auto-remove do cron quando zera.
--
-- Agendado em runtime (NAO comitar o schedule, e temporario):
--   select cron.schedule('baixas_backfill_bar4', '*/3 * * * *', 'select public.drain_baixas_bar4()');
-- Auto-unschedule quando restantes=0. Para remover na mao:
--   select cron.unschedule('baixas_backfill_bar4');
create or replace function public.drain_baixas_bar4()
returns void language plpgsql security definer set search_path to 'public' as $$
declare restantes int;
begin
  select count(*) into restantes
  from bronze.bronze_contaazul_lancamentos
  where bar_id=4 and excluido_em is null and valor_pago > 0 and baixas_synced_em is null;

  if restantes = 0 then
    perform cron.unschedule('baixas_backfill_bar4');
    return;
  end if;

  perform net.http_post(
    url := get_supabase_url() || '/functions/v1/contaazul-baixas',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || get_service_role_key()),
    body := jsonb_build_object('bar_id', 4, 'modo', 'baixas', 'limit', 500),
    timeout_milliseconds := 290000);
end; $$;
