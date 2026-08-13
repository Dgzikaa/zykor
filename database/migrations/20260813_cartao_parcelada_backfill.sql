-- Backfill: parcelas que JA foram lancadas no Conta Azul pelo fluxo da fatura
--
-- A protecao contra lancar a mesma parcela duas vezes so conhece o que passou pelo fluxo novo
-- (20260813_cartao_compra_parcelada.sql). Compra parcelada lancada antes disso ficaria desprotegida:
-- quando a fatura do mes seguinte trouxesse a proxima parcela, o Zykor nao saberia que as anteriores
-- ja estao no CA.
--
-- Fonte EXATA: financial.cartao_fatura_linhas com status='lancado' e parcela preenchida — tem banco,
-- final do cartao, data da compra e valor, que sao exatamente as pecas da chave. Parcela lancada na
-- MAO direto no Conta Azul nao aparece aqui e nao da pra reconstruir a chave a partir do CA (ele nao
-- guarda cartao nem data da compra); essa fica por conta da checagem contra o CA na hora de lancar,
-- onde a evidencia aparece na tela e a pessoa decide.
--
-- Idempotente: pode rodar de novo que so acrescenta parcela nova a lista.
insert into financial.cartao_compra_parcelada (
  chave, bar_id, banco, cartao_final, descricao, data_transacao,
  total_parcelas, valor_parcela, modo_competencia, parcelas_lancadas, contaazul_ids, criado_por
)
select
  lower(coalesce(l.banco, '')) || '|' || coalesce(l.cartao_final, '') || '|'
    || l.data_transacao::text || '|' || l.tot || '|' || round(l.valor)::text as chave,
  max(l.bar_id),
  max(l.banco),
  max(l.cartao_final),
  max(l.descricao),
  max(l.data_transacao),
  max(l.tot),
  max(l.valor),
  'compra',                                   -- foi assim que o fluxo antigo lancou
  array_agg(distinct l.n order by l.n),
  array_remove(array_agg(distinct l.contaazul_lancamento_id), null),
  'backfill'
from (
  select bar_id, banco, cartao_final, descricao, data_transacao, valor, contaazul_lancamento_id,
    (regexp_match(parcela, '(\d+)\s*de\s*(\d+)'))[1]::int as n,
    (regexp_match(parcela, '(\d+)\s*de\s*(\d+)'))[2]::int as tot
  from financial.cartao_fatura_linhas
  where parcela is not null and status = 'lancado' and bar_id is not null
) l
where l.tot > 1 and l.n between 1 and l.tot
group by 1
on conflict (chave) do update set
  parcelas_lancadas = (
    select array_agg(distinct x order by x)
    from unnest(financial.cartao_compra_parcelada.parcelas_lancadas || excluded.parcelas_lancadas) x
  ),
  atualizado_em = now();
