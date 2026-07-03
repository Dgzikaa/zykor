-- Stone→CA: nome do pagador do PIX na descrição do lançamento.
-- O CSV bruto do PIX tem `pix_transaction__payer__name` (campo 15). Não era extraído.
-- Carregamos o nome pela cadeia que já existe: bronze → stone_pix_transacoes (parser)
-- → stone_transacoes (sync) → RPC stone_ca_lancamentos_dia. Sem trocar a fonte do PIX.

-- 1) colunas do nome
alter table silver.stone_pix_transacoes add column if not exists payer_name text;
alter table silver.stone_transacoes    add column if not exists pix_pagador text;

-- 2) parser passa a extrair o nome (campo 15). f[15] fora do range = NULL (sem erro).
create or replace function silver.parse_stone_pix_pendentes()
 returns integer
 language plpgsql
 set search_path to 'public','gold','silver','bronze','financial','operations','meta','crm','system','extensions','pg_temp'
as $function$
DECLARE
  r record; arr text[]; ln text; f text[]; i int; cnt int := 0;
BEGIN
  FOR r IN SELECT * FROM bronze.bronze_stone_pix WHERE csv_raw IS NOT NULL AND parsed_em IS NULL LOOP
    DELETE FROM silver.stone_pix_transacoes WHERE bar_id=r.bar_id AND document=r.document AND reference_date=r.reference_date;
    arr := string_to_array(replace(r.csv_raw, E'\r', ''), E'\n');
    FOR i IN 2 .. COALESCE(array_length(arr,1),1) LOOP
      ln := arr[i];
      CONTINUE WHEN ln IS NULL OR length(btrim(ln)) = 0;
      f := string_to_array(ln, ',');
      CONTINUE WHEN COALESCE(array_length(f,1),0) < 13;
      INSERT INTO silver.stone_pix_transacoes
        (id,bar_id,document,reference_date,status,amount,paid_amount,canceled_amount,fee_amount,net_amount,created_at_utc,dt_gerencial,terminal_serial,payer_name)
      VALUES (
        f[1], r.bar_id, r.document, r.reference_date, f[3],
        NULLIF(f[2],'')::numeric/100,
        NULLIF(f[11],'')::numeric/100,
        NULLIF(f[12],'')::numeric/100,
        NULLIF(f[13],'')::numeric/100,
        (COALESCE(NULLIF(f[11],'')::numeric,0) - COALESCE(NULLIF(f[13],'')::numeric,0))/100,
        f[5]::timestamptz,
        ((f[5]::timestamptz AT TIME ZONE 'America/Sao_Paulo') - interval '6 hours')::date,
        (regexp_match(ln, 'Terminal, value=([A-Za-z0-9]+)'))[1],
        NULLIF(btrim(f[15]),'')
      )
      ON CONFLICT (id) DO UPDATE SET
        bar_id=excluded.bar_id, document=excluded.document, reference_date=excluded.reference_date,
        status=excluded.status, amount=excluded.amount, paid_amount=excluded.paid_amount,
        canceled_amount=excluded.canceled_amount, fee_amount=excluded.fee_amount, net_amount=excluded.net_amount,
        created_at_utc=excluded.created_at_utc, dt_gerencial=excluded.dt_gerencial, terminal_serial=excluded.terminal_serial,
        payer_name=excluded.payer_name;
      cnt := cnt + 1;
    END LOOP;
    UPDATE bronze.bronze_stone_pix SET parsed_em=now() WHERE bar_id=r.bar_id AND document=r.document AND reference_date=r.reference_date;
  END LOOP;
  RETURN cnt;
END $function$;

-- 3) sync carrega o nome pro stone_transacoes (usado pela RPC)
create or replace function silver.sync_pix_to_stone_transacoes()
 returns integer
 language plpgsql
 set search_path to 'public','gold','silver','bronze','financial','operations','meta','crm','system','extensions','pg_temp'
as $function$
DECLARE n int;
BEGIN
  DELETE FROM silver.stone_transacoes WHERE account_type = 99;
  INSERT INTO silver.stone_transacoes
    (id, bar_id, stone_code, empresa_nome, reference_date, capture_local_dt,
     gross_amount, net_amount, fee_amount, account_type, brand_id, poi_serial_number, parsed_at, capture_date, pix_pagador)
  SELECT md5(p.id)::uuid, p.bar_id, m.stone_code, m.empresa_nome, p.reference_date,
         (p.created_at_utc AT TIME ZONE 'America/Sao_Paulo'),
         p.amount, p.net_amount, p.fee_amount, 99, NULL, p.terminal_serial, now(),
         (p.created_at_utc AT TIME ZONE 'America/Sao_Paulo')::date, p.payer_name
  FROM silver.stone_pix_transacoes p
  JOIN financial.stone_cnpj_map m ON regexp_replace(m.cnpj_documento,'\D','','g') = p.document
  WHERE p.status = 'paid';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- 4) RPC devolve `pagador` (nome no PIX; null no cartão). DROP+CREATE (muda a assinatura de retorno).
drop function if exists financial.stone_ca_lancamentos_dia(integer, date);
create function financial.stone_ca_lancamentos_dia(p_bar_id integer, p_data date)
returns table(tipo text, brand_id integer, vencimento date, chave text, transacoes bigint, bruto numeric, taxa numeric, pagador text)
language sql stable
set search_path to 'financial', 'silver', 'public', 'pg_catalog'
as $function$
  with cfg as (
    select coalesce(c.antecipa, false) as antecipa, coalesce(c.dias_landing, '{1}') as dias_landing
    from (select 1) x
    left join financial.stone_antecipacao_config c on c.bar_id = p_bar_id
  ),
  venc_antecipado as (
    select financial.fn_stone_venc_antecipado(p_data, (select dias_landing from cfg)) as v
  ),
  base as (
    select
      s.*,
      case when (s.prevision_payment_date - s.dt_gerencial) > 15 then 'CREDITO' else 'DEBITO' end as tp,
      case
        when (select antecipa from cfg)
             and (s.prevision_payment_date - s.dt_gerencial) > 15
          then (select v from venc_antecipado)
        else coalesce(s.prevision_payment_date, p_data)
      end as venc
    from silver.stone_transacoes s
    where s.bar_id = p_bar_id and s.dt_gerencial = p_data and s.account_type <> 99
  )
  -- Crédito / Débito: agrupado por bandeira × vencimento (sem pagador)
  select
    b.tp as tipo,
    b.brand_id,
    b.venc as vencimento,
    b.tp || '|' || coalesce(b.brand_id::text, '0') || '|' || b.venc::text as chave,
    count(*)::bigint,
    round(sum(b.gross_amount), 2),
    round(sum(b.fee_amount), 2),
    null::text as pagador
  from base b
  group by b.tp, b.brand_id, b.venc
  union all
  -- PIX: 1 lançamento por transação, com o nome do pagador
  select
    'PIX' as tipo,
    s.brand_id,
    coalesce(s.prevision_payment_date, p_data) as vencimento,
    'PIX|' || coalesce(s.acquirer_transaction_key, s.id::text) as chave,
    1::bigint,
    round(s.gross_amount, 2),
    round(s.fee_amount, 2),
    s.pix_pagador as pagador
  from silver.stone_transacoes s
  where s.bar_id = p_bar_id and s.dt_gerencial = p_data and s.account_type = 99;
$function$;
