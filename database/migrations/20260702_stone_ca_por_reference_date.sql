-- Stone→CA: usar o dia-CALENDÁRIO da Stone (reference_date), não o dt_gerencial (corte 6h).
-- Motivo: a Stone fecha o arquivo por meia-noite; conciliar contra ela exige a mesma quebra de dia.
-- (Uma transação de 00h27 do 01/07 tem reference_date=01/07 mas dt_gerencial=30/06.)
-- O dt_gerencial (corte operacional de 6h) segue intacto p/ a conciliação ContaHub×Stone.
create or replace function financial.stone_ca_lancamentos_dia(p_bar_id integer, p_data date)
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
      case when (s.prevision_payment_date - coalesce(s.reference_date, s.capture_local_dt::date)) > 15 then 'CREDITO' else 'DEBITO' end as tp,
      case
        when (select antecipa from cfg)
             and (s.prevision_payment_date - coalesce(s.reference_date, s.capture_local_dt::date)) > 15
          then (select v from venc_antecipado)
        else coalesce(s.prevision_payment_date, p_data)
      end as venc
    from silver.stone_transacoes s
    where s.bar_id = p_bar_id
      and coalesce(s.reference_date, s.capture_local_dt::date) = p_data
      and s.account_type <> 99
  )
  -- Crédito / Débito: agrupado por bandeira × vencimento
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
  where s.bar_id = p_bar_id
    and coalesce(s.reference_date, s.capture_local_dt::date) = p_data
    and s.account_type = 99;
$function$;
