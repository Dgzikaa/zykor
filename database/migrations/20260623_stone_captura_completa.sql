-- Stone: capturar TUDO que o arquivo de conciliação (XML2_2) oferece.
-- Antes só líamos FinancialTransactions (campos núcleo). Agora:
--   1) campos extras da transação: Events (chargeback/cancelamento/captura),
--      Poi (maquininha), Authorized/CapturedAmount, IssuerAuthorizationCode,
--      InstallmentType, FeeType, AuthorizationCurrencyCode
--   2) seção Payments (repasses reais ao banco) -> nova silver.stone_pagamentos
-- Re-parse de todo o histórico é possível pois bronze guarda xml_raw.

-- 1) Colunas extras na transação
alter table silver.stone_transacoes
  add column if not exists ev_captures integer,
  add column if not exists ev_cancellations integer,
  add column if not exists ev_cancellation_charges integer,
  add column if not exists ev_chargebacks integer,
  add column if not exists ev_chargeback_refunds integer,
  add column if not exists ev_payments integer,
  add column if not exists installment_type integer,
  add column if not exists authorized_amount numeric,
  add column if not exists captured_amount numeric,
  add column if not exists authorization_currency_code text,
  add column if not exists issuer_authorization_code text,
  add column if not exists fee_type integer,
  add column if not exists poi_type integer,
  add column if not exists poi_serial_number text;

-- 2) Nova tabela de repasses (Payments)
create table if not exists silver.stone_pagamentos (
  id bigint generated always as identity primary key,
  bar_id integer not null,
  stone_code text not null,
  empresa_nome text,
  reference_date date not null,
  payment_id text,
  wallet_type_id integer,
  total_amount numeric,
  total_financial_accounts_amount numeric,
  last_negative_amount numeric,
  bank_code text,
  bank_branch text,
  bank_account_number text,
  parsed_at timestamptz default now()
);
create index if not exists ix_stone_pag_bar_data on silver.stone_pagamentos (bar_id, reference_date);
create unique index if not exists ux_stone_pag_unico
  on silver.stone_pagamentos (bar_id, stone_code, reference_date, coalesce(payment_id,''));

-- 3) Parser completo (transação + pagamentos)
create or replace function silver.parse_stone_conciliacao(p_bar_id integer, p_stone_code text, p_reference_date date)
returns integer
language plpgsql
as $function$
declare v_xml xml; v_n integer; v_empresa text;
begin
  select xml_raw::xml into v_xml from bronze.bronze_stone_conciliacao
   where bar_id=p_bar_id and stone_code=p_stone_code and reference_date=p_reference_date
     and xml_raw is not null order by synced_at desc limit 1;
  if v_xml is null then return 0; end if;

  select empresa_nome into v_empresa from public.api_credentials
   where bar_id=p_bar_id and sistema='stone' and configuracoes->'stone_codes' ? p_stone_code limit 1;

  -- ===== Transações (uma linha por parcela) =====
  delete from silver.stone_transacoes
   where bar_id=p_bar_id and stone_code=p_stone_code and reference_date=p_reference_date;

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

  -- ===== Pagamentos / repasses ao banco =====
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