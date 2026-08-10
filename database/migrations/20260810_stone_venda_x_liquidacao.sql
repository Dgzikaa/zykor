-- =============================================================================
-- Venda x Liquidação da Stone, lado a lado — alimenta a aba "Venda × Recebimento"
-- em /financeiro/receitas. Aplicado em produção em 10/08/2026.
-- =============================================================================
--
-- POR QUE EXISTE. O financeiro compara o extrato da maquininha com o que o Zykor lançou
-- no Conta Azul, vê números diferentes e conclui que está lançando errado. Não está —
-- são réguas diferentes:
--   VENDA      (o que o Zykor lança) = dia em que o cliente passou o cartão.
--   LIQUIDAÇÃO (o que a máquina mostra) = dia em que a Stone pagou. Débito D+1,
--              crédito ~D+30, PIX no mesmo dia, e descontos já vêm abatidos.
--
-- Em 10/08/2026 isso consumiu uma investigação inteira, em dois bares, pelo mesmo motivo:
--   Deboche/Descubra 07/08: Mastercard 666,32 na venda × 405,32 no extrato → CrossBalance 261,00
--   Ordibar 07/08:          Mastercard 2.836,87 × 2.488,87 no extrato      → CrossBalance 348,00
-- Nos dois casos Visa e Elo bateram na vírgula; só o Mastercard tinha o evento.
--
-- CrossBalance = transferência entre carteiras da própria Stone (sai de uma, entra em
-- outra). NÃO aparece em <FinancialTransactions>, só em <FinancialEvents> do XML — por
-- isso ninguém achava olhando as transações.
--
-- PIX: a Stone manda `prevision_payment_date` NULL porque liquida em D+0. Sem o coalesce
-- ele sumia da coluna de liquidação, e o extrato mostra o PIX no dia.
-- =============================================================================

create or replace function public.stone_venda_x_liquidacao(
  p_bar_id integer,
  p_data   date
) returns jsonb
language sql
stable
security definer
set search_path = public, silver, bronze, financial
as $$
with empresas as (
  select stone_code, empresa_nome from financial.stone_cnpj_map where bar_id = p_bar_id
),
-- classificação idêntica à do lançador Stone->CA (financial.stone_ca_lancamentos_dia):
-- crédito = previsão de pagamento a mais de 15 dias da venda; PIX = account_type 99.
-- Se divergir daqui, a tela vai acusar erro onde não há.
tx as (
  select s.stone_code,
         case when s.account_type = 99 then 'PIX'
              when (s.prevision_payment_date - coalesce(s.reference_date, s.capture_local_dt::date)) > 15 then 'Crédito'
              else 'Débito' end as tipo,
         case s.brand_id when 1 then 'Visa' when 2 then 'Mastercard' when 3 then 'Amex'
              when 4 then 'Hipercard' when 171 then 'Elo'
              else coalesce('Bandeira ' || s.brand_id::text, '—') end as bandeira,
         coalesce(s.reference_date, s.capture_local_dt::date) as dia_venda,
         coalesce(s.prevision_payment_date, s.reference_date, s.capture_local_dt::date) as dia_liquidacao,
         s.gross_amount, s.fee_amount
    from silver.stone_transacoes s
   where s.bar_id = p_bar_id
     and (coalesce(s.reference_date, s.capture_local_dt::date) = p_data
          or coalesce(s.prevision_payment_date, s.reference_date, s.capture_local_dt::date) = p_data)
),
venda as (
  select t.stone_code, e.empresa_nome, t.tipo, t.bandeira, count(*) n,
         round(sum(t.gross_amount),2) bruto,
         round(sum(t.gross_amount - t.fee_amount),2) liquido
    from tx t left join empresas e on e.stone_code = t.stone_code
   where t.dia_venda = p_data
   group by 1,2,3,4
),
liquidacao as (
  select t.stone_code, e.empresa_nome, t.tipo, t.bandeira, count(*) n,
         round(sum(t.gross_amount),2) bruto,
         round(sum(t.gross_amount - t.fee_amount),2) liquido,
         min(t.dia_venda) dia_venda_min, max(t.dia_venda) dia_venda_max
    from tx t left join empresas e on e.stone_code = t.stone_code
   where t.dia_liquidacao = p_data
   group by 1,2,3,4
),
-- Eventos que afetam o repasse DESTE dia. Só o lado negativo: é ele que explica por que
-- o extrato mostra menos que a soma das vendas. A janela de 40 dias para trás cobre o
-- arquivo em que o evento foi publicado (ele vem no XML do dia da venda, não do repasse).
eventos as (
  select b.stone_code, e2.empresa_nome,
         (xpath('/Event/Description/text()', ev))[1]::text descricao,
         round(sum((xpath('/Event/Amount/text()', ev))[1]::text::numeric), 2) valor
    from bronze.bronze_stone_conciliacao b
    left join empresas e2 on e2.stone_code = b.stone_code,
         unnest(xpath('/Conciliation/FinancialEvents/Event', b.xml_raw::xml)) ev
   where b.bar_id = p_bar_id
     and b.reference_date between p_data - 40 and p_data
     and b.xml_raw is not null
     and (xpath('/Event/PrevisionPaymentDate/text()', ev))[1]::text = to_char(p_data, 'YYYYMMDD')
     and (xpath('/Event/Amount/text()', ev))[1]::text::numeric < 0
   group by 1,2,3
)
select jsonb_build_object(
  'data', p_data,
  'venda',      coalesce((select jsonb_agg(to_jsonb(v) order by v.empresa_nome, v.tipo, v.bandeira) from venda v), '[]'::jsonb),
  'liquidacao', coalesce((select jsonb_agg(to_jsonb(l) order by l.empresa_nome, l.tipo, l.bandeira) from liquidacao l), '[]'::jsonb),
  'eventos',    coalesce((select jsonb_agg(to_jsonb(ev) order by ev.empresa_nome) from eventos ev), '[]'::jsonb)
);
$$;

comment on function public.stone_venda_x_liquidacao(integer, date) is
  'Venda (o que o Zykor lanca no CA) x Liquidacao (o que a maquininha mostra) da Stone num dia, mais os eventos (CrossBalance etc) que explicam a diferenca.';
