-- Stone→CA: antecipação de crédito por bar.
-- Alguns bares antecipam o crédito pra DATAS FIXAS do mês (ex.: bar 3 = dia 01; pode ser 01 e 15),
-- independente do dia da venda. Então o crédito não cai no D+30 do relatório Stone
-- (prevision_payment_date), e sim no PRÓXIMO "dia da lista" após a venda, rolado pro próximo dia útil.
-- Débito (≈D+1) e PIX (na hora) NÃO são antecipados — seguem a previsão da Stone (que já vem
-- ajustada pra dia útil).

-- 1) Config por bar (liga/desliga + em quais dias do mês o crédito cai — pode ser mais de um)
create table if not exists financial.stone_antecipacao_config (
  bar_id          integer primary key,
  antecipa        boolean not null default false,      -- antecipa o crédito?
  dias_landing    integer[] not null default '{1}',    -- dias do mês em que o crédito cai (ex.: {1,15})
  antecipa_debito boolean not null default false,      -- reservado (hoje só crédito)
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text
);
alter table financial.stone_antecipacao_config enable row level security;
grant select, insert, update, delete on financial.stone_antecipacao_config to service_role;

-- bar 3 antecipa todo dia 01; bar 4 fica sem linha → default antecipa=false (usa a previsão Stone)
insert into financial.stone_antecipacao_config (bar_id, antecipa, dias_landing, atualizado_por)
values (3, true, '{1}', 'migration')
on conflict (bar_id) do nothing;

-- 2) Primeiro dia ÚTIL >= p_data (pula sábado/domingo e feriados de operations.feriados_eventos)
create or replace function financial.fn_dia_util_ou_seguinte(p_data date)
returns date language plpgsql stable
set search_path to 'operations','public','pg_catalog'
as $$
declare d date := p_data;
begin
  while extract(dow from d) in (0, 6)   -- 0=domingo, 6=sábado
     or exists (select 1 from operations.feriados_eventos f where f.data = d) loop
    d := d + 1;
  end loop;
  return d;
end;
$$;

-- 3) Vencimento antecipado: o PRÓXIMO "dia da lista" ESTRITAMENTE após p_ref, rolado pro dia útil.
--    Gera os candidatos no mês da venda e no mês seguinte (cobre a virada) e pega o menor > p_ref.
--    Ex. dias {1,15}: venda 28/06 → 01/07; venda 03/07 → 15/07; venda 16/07 → 01/08.
create or replace function financial.fn_stone_venc_antecipado(p_ref date, p_dias integer[])
returns date language sql stable
as $$
  select financial.fn_dia_util_ou_seguinte(min(cand))
  from (
    select (date_trunc('month', p_ref)::date + (d - 1))                       as cand from unnest(p_dias) d
    union all
    select ((date_trunc('month', p_ref) + interval '1 month')::date + (d - 1))        from unnest(p_dias) d
  ) c
  where cand > p_ref;
$$;

-- 4) Agregação do dia com a antecipação aplicada só no CRÉDITO (conforme config do bar)
create or replace function financial.stone_ca_lancamentos_dia(p_bar_id integer, p_data date)
returns table(tipo text, brand_id integer, vencimento date, chave text, transacoes bigint, bruto numeric, taxa numeric)
language sql stable
set search_path to 'financial', 'silver', 'public', 'pg_catalog'
as $function$
  with cfg as (
    -- sempre 1 linha (defaults quando o bar não tem config)
    select coalesce(c.antecipa, false) as antecipa, coalesce(c.dias_landing, '{1}') as dias_landing
    from (select 1) x
    left join financial.stone_antecipacao_config c on c.bar_id = p_bar_id
  ),
  venc_antecipado as (
    -- todas as vendas desta chamada têm dt_gerencial = p_data → data antecipada única
    select financial.fn_stone_venc_antecipado(p_data, (select dias_landing from cfg)) as v
  ),
  base as (
    select
      s.*,
      case when (s.prevision_payment_date - s.dt_gerencial) > 15 then 'CREDITO' else 'DEBITO' end as tp,
      -- crédito antecipado (se o bar antecipa) cai na data fixa; senão previsão Stone
      case
        when (select antecipa from cfg)
             and (s.prevision_payment_date - s.dt_gerencial) > 15
          then (select v from venc_antecipado)
        else coalesce(s.prevision_payment_date, p_data)
      end as venc
    from silver.stone_transacoes s
    where s.bar_id = p_bar_id and s.dt_gerencial = p_data and s.account_type <> 99
  )
  -- Crédito / Débito: agrupado por bandeira × vencimento
  select
    b.tp as tipo,
    b.brand_id,
    b.venc as vencimento,
    b.tp || '|' || coalesce(b.brand_id::text, '0') || '|' || b.venc::text as chave,
    count(*)::bigint,
    round(sum(b.gross_amount), 2),
    round(sum(b.fee_amount), 2)
  from base b
  group by b.tp, b.brand_id, b.venc
  union all
  -- PIX: 1 lançamento por transação (nunca antecipa)
  select
    'PIX' as tipo,
    s.brand_id,
    coalesce(s.prevision_payment_date, p_data) as vencimento,
    'PIX|' || coalesce(s.acquirer_transaction_key, s.id::text) as chave,
    1::bigint,
    round(s.gross_amount, 2),
    round(s.fee_amount, 2)
  from silver.stone_transacoes s
  where s.bar_id = p_bar_id and s.dt_gerencial = p_data and s.account_type = 99;
$function$;
