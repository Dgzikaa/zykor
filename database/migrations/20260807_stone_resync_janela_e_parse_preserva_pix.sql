-- Stone: dois consertos da mesma falha — receita sumindo da DRE sem ninguém perceber.
--
-- CONTEXTO (jul/2026): a Receita da DRE de julho do bar 3 estava R$ 38.697,49 abaixo do real.
-- Causa: a Stone entregou o arquivo de conciliação do dia 31/07 INCOMPLETO (376 KB / 176
-- transações) na janela em que o cron baixa (D-1 e D-2). O arquivo completo (853 KB / 555
-- transações) só ficou disponível depois — e o cron nunca mais volta nesse dia. Resultado:
-- silver curto → lançamento Stone→CA curto → DRE curta. Silencioso: nada falha, o número
-- só fica menor. Mesma família de [[feedback_data_freshness_watchdog]].
--
-- 1) parse_stone_conciliacao: o DELETE apagava TAMBÉM as linhas de PIX.
--    O PIX (account_type=99) não vem deste XML — vem de silver.sync_pix_to_stone_transacoes
--    (bronze_stone_pix → stone_pix_transacoes), que é dono exclusivo dessas linhas (ele
--    deleta todas as 99 e reinsere). Reparsar um dia zerava o PIX daquele reference_date até
--    o drainer rodar (a cada 10 min) — e, pior, se o lançamento Stone→CA rodasse nessa janela,
--    o dia ia pro Conta Azul SEM o PIX. Agora o DELETE preserva account_type=99.
--
-- 2) A janela de re-sync do cron (D-1, D-2) sobe pra D-1..D-7, então um arquivo que a Stone
--    completa em D+3/D+4 é recapturado. Ver alteração do cron.job 'stone-sync-diario' abaixo.

create or replace function silver.parse_stone_conciliacao(p_bar_id integer, p_stone_code text, p_reference_date date)
returns integer
language plpgsql
set search_path to 'public', 'gold', 'silver', 'bronze', 'financial', 'operations', 'meta', 'crm', 'system', 'extensions', 'pg_temp'
as $function$
declare v_xml xml; v_n integer; v_empresa text;
begin
  select xml_raw::xml into v_xml from bronze.bronze_stone_conciliacao
   where bar_id=p_bar_id and stone_code=p_stone_code and reference_date=p_reference_date
     and xml_raw is not null order by synced_at desc limit 1;
  if v_xml is null then return 0; end if;

  select empresa_nome into v_empresa from public.api_credentials
   where bar_id=p_bar_id and sistema='stone' and configuracoes->'stone_codes' ? p_stone_code limit 1;

  -- account_type 99 = PIX, dono é silver.sync_pix_to_stone_transacoes. NÃO apagar aqui.
  delete from silver.stone_transacoes
   where bar_id=p_bar_id and stone_code=p_stone_code and reference_date=p_reference_date
     and account_type is distinct from 99;

  insert into silver.stone_transacoes (
    bar_id, stone_code, empresa_nome, reference_date, acquirer_transaction_key,
    initiator_transaction_key, authorization_dt, capture_local_dt, capture_date, account_type, brand_id,
    entry_mode, number_of_installments, installment_number, card_number_masked,
    international, gross_amount, net_amount, fee_amount, prevision_payment_date,
    ev_captures, ev_cancellations, ev_cancellation_charges, ev_chargebacks, ev_chargeback_refunds, ev_payments,
    installment_type, authorized_amount, captured_amount, authorization_currency_code,
    issuer_authorization_code, fee_type, poi_type, poi_serial_number)
  select
    p_bar_id, p_stone_code, v_empresa, p_reference_date, x.acquirer_key, x.initiator_key,
    to_timestamp(nullif(x.auth_dt,''), 'YYYYMMDDHH24MISS'),
    to_timestamp(nullif(x.capture_dt,''), 'YYYYMMDDHH24MISS'),
    to_date(left(nullif(x.capture_dt,''),8), 'YYYYMMDD'),
    x.account_type, x.brand_id, x.entry_mode, x.num_inst, x.inst_number, x.card_masked,
    (lower(coalesce(x.international,'false')) = 'true'),
    x.gross, x.net, (x.gross - x.net),
    to_date(nullif(x.prevision_date,''), 'YYYYMMDD'),
    x.ev_captures, x.ev_cancellations, x.ev_cancellation_charges, x.ev_chargebacks, x.ev_chargeback_refunds, x.ev_payments,
    x.installment_type, x.authorized_amount, x.captured_amount, x.auth_currency,
    x.issuer_auth_code, x.fee_type, x.poi_type, x.poi_serial
  from xmltable(
    -- Só FinancialTransactions (capturas do dia). FinancialTransactionsAccounts é a LIQUIDAÇÃO
    -- de recebíveis de vendas antigas — incluir duplicaria a venda no dia do repasse.
    '/Conciliation/FinancialTransactions/Transaction/Installments/Installment'
    passing v_xml
    columns
      acquirer_key text path '../../AcquirerTransactionKey',
      initiator_key text path '../../InitiatorTransactionKey',
      auth_dt text path '../../AuthorizationDateTime',
      capture_dt text path '../../CaptureLocalDateTime',
      account_type integer path '../../AccountType',
      brand_id integer path '../../BrandId',
      entry_mode integer path '../../EntryMode',
      num_inst integer path '../../NumberOfInstallments',
      card_masked text path '../../CardNumber',
      international text path '../../International',
      ev_captures integer path '../../Events/Captures',
      ev_cancellations integer path '../../Events/Cancellations',
      ev_cancellation_charges integer path '../../Events/CancellationCharges',
      ev_chargebacks integer path '../../Events/Chargebacks',
      ev_chargeback_refunds integer path '../../Events/ChargebackRefunds',
      ev_payments integer path '../../Events/Payments',
      installment_type integer path '../../InstallmentType',
      authorized_amount numeric path '../../AuthorizedAmount',
      captured_amount numeric path '../../CapturedAmount',
      auth_currency text path '../../AuthorizationCurrencyCode',
      issuer_auth_code text path '../../IssuerAuthorizationCode',
      fee_type integer path '../../FeeType',
      poi_type integer path '../../Poi/PoiType',
      poi_serial text path '../../Poi/SerialNumber',
      inst_number integer path 'InstallmentNumber',
      gross numeric path 'GrossAmount',
      net numeric path 'NetAmount',
      prevision_date text path 'PrevisionPaymentDate'
  ) x;
  get diagnostics v_n = row_count;

  delete from silver.stone_pagamentos
   where bar_id=p_bar_id and stone_code=p_stone_code and reference_date=p_reference_date;

  insert into silver.stone_pagamentos (
    bar_id, stone_code, empresa_nome, reference_date, payment_id, wallet_type_id,
    total_amount, total_financial_accounts_amount, last_negative_amount,
    bank_code, bank_branch, bank_account_number)
  select
    p_bar_id, p_stone_code, v_empresa, p_reference_date, y.id, y.wallet,
    y.total, y.total_fa, y.last_neg, y.bank_code, y.bank_branch, y.bank_acc
  from xmltable(
    '/Conciliation/Payments/Payment'
    passing v_xml
    columns
      id text path 'Id',
      wallet integer path 'WalletTypeId',
      total numeric path 'TotalAmount',
      total_fa numeric path 'TotalFinancialAccountsAmount',
      last_neg numeric path 'LastNegativeAmount',
      bank_code text path 'FavoredBankAccount/BankCode',
      bank_branch text path 'FavoredBankAccount/BankBranch',
      bank_acc text path 'FavoredBankAccount/BankAccountNumber'
  ) y;

  update bronze.bronze_stone_conciliacao set parsed_em = now()
   where bar_id=p_bar_id and stone_code=p_stone_code and reference_date=p_reference_date;
  return v_n;
end; $function$;

-- 2) Janela de re-sync D-1..D-7 (era D-1, D-2). O upsert do bronze zera parsed_em, então o
--    stone-parse-diario (:24) reprocessa sozinho o que mudou. Baixar de novo um dia já completo
--    é idempotente — o parse regrava as mesmas linhas.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'stone-sync-diario'),
  command := $cmd$
  select net.http_post(
    url := 'https://zykor.com.br/api/stone/conciliacao/sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
    body := jsonb_build_object('bar_id', b.bar_id, 'reference_date', to_char(current_date - d.dia, 'YYYY-MM-DD')),
    timeout_milliseconds := 55000)
  from (values (3),(4)) b(bar_id) cross join (values (1),(2),(3),(4),(5),(6),(7)) d(dia);
$cmd$);
