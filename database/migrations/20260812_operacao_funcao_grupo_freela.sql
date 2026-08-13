-- =============================================================================
-- Ponte funcao -> grupo de pagamento do freela — 12/08/2026
-- =============================================================================
--
-- Descoberto ao montar o planejado x realizado: o pagamento de freela NAO tem a mesma
-- granularidade do plano. O plano projeta por FUNCAO e por DIA; o pagamento acontece por
-- SEMANA (competencia = segunda) e em 5 categorias grossas:
--   FREELA ATENDIMENTO | FREELA BAR | FREELA COZINHA | FREELA SEGURANCA | FREELA LIMPEZA
--
-- Sem essa ponte nao da pra comparar as duas coisas. Fica como DADO e nao como constante
-- no codigo porque a categoria do financeiro muda sem avisar o plano operacional.
-- =============================================================================

alter table operations.operacao_funcao
  add column if not exists grupo_freela text;

comment on column operations.operacao_funcao.grupo_freela is
  'Categoria em que o freela desta funcao e pago (financial.pedidos_pagamento.categoria_nome '
  'sem o prefixo "FREELA "). E a ponte do planejado x realizado — o plano projeta por funcao '
  'e por dia, o pagamento acontece por grupo e por semana.';

update operations.operacao_funcao set grupo_freela = case codigo
  when 'garcom'     then 'ATENDIMENTO'
  when 'cumim'      then 'ATENDIMENTO'
  when 'host'       then 'ATENDIMENTO'
  when 'bartender'  then 'BAR'
  when 'barback'    then 'BAR'
  when 'cozinha'    then 'COZINHA'
  when 'seguranca'  then 'SEGURANÇA'
  when 'brigadista' then 'SEGURANÇA'
  when 'asg'        then 'LIMPEZA'
  else null
end
where bar_id = 3;
