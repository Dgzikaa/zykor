-- Visão unificada de TUDO que o Zykor lançou no Conta Azul (auditoria/histórico).
-- Junta os logs de cada fluxo num formato comum: origem, sinal, competência, descrição,
-- categoria, valor, protocolo/status do CA, quem e quando.
create or replace view financial.v_ca_lancamentos_zykor as
-- Fechamentos: variação de estoque, consumação, imposto, ajuste virada
select l.bar_id, l.tipo as origem, l.sinal, l.competencia::date as competencia,
  l.descricao, l.categoria_nome as categoria, l.valor, l.ca_protocol_id, l.ca_status,
  l.criado_por, l.created_at as quando
from financial.lancamento_manual_ca_log l
union all
-- Bonificações: perna RECEITA (só as lançadas)
select b.bar_id, 'bonificacao', 'RECEITA', b.competencia_receita::date,
  'Bonificação '||b.fornecedor, b.categoria_receita, b.valor, b.ca_receita_protocol_id, b.ca_receita_status,
  coalesce(b.lancado_por, b.criado_por), coalesce(b.lancado_em, b.updated_at)
from financial.bonificacoes b where b.ca_receita_protocol_id is not null
union all
-- Bonificações: perna DESPESA (só as lançadas)
select b.bar_id, 'bonificacao', 'DESPESA', b.competencia_despesa::date,
  'Bonificação '||b.fornecedor, b.categoria_despesa, b.valor, b.ca_despesa_protocol_id, b.ca_despesa_status,
  coalesce(b.lancado_por, b.criado_por), coalesce(b.lancado_em, b.updated_at)
from financial.bonificacoes b where b.ca_despesa_protocol_id is not null
union all
-- Entradas de dinheiro (ContaHub)
select e.bar_id, 'entrada_dinheiro', 'RECEITA', e.dt_gerencial::date,
  'Dinheiro recebido', 'Dinheiro', e.valor, e.ca_protocol_id, e.ca_status, e.criado_por, e.created_at
from financial.entrada_caixa_ca_log e
union all
-- Saídas de dinheiro (sangria)
select s.bar_id, 'saida_dinheiro', 'DESPESA', s.dt_gerencial::date,
  s.descricao, null::text, s.valor, s.ca_protocol_id, s.ca_status, s.criado_por, s.created_at
from financial.saida_caixa_ca_log s
union all
-- Sympla
select y.bar_id, 'sympla', 'RECEITA', y.dt_evento::date,
  y.descricao, 'Sympla', y.valor, y.ca_protocol_id, y.ca_status, y.criado_por, y.created_at
from financial.sympla_ca_log y
union all
-- Stone
select t.bar_id, 'stone',
  case when lower(coalesce(t.natureza,'')) like '%desp%' or lower(coalesce(t.tipo,'')) like '%taxa%' then 'DESPESA' else 'RECEITA' end,
  t.data_venda::date, 'Stone '||coalesce(t.natureza, t.tipo, ''), coalesce(t.natureza, t.tipo), t.valor,
  t.ca_protocol_id, t.ca_status, t.criado_por, t.criado_em
from financial.stone_ca_lancamento_log t;

comment on view financial.v_ca_lancamentos_zykor is
  'Histórico unificado de tudo que o Zykor lançou no Conta Azul (fechamentos, bonificações, entradas/saídas dinheiro, Sympla, Stone).';
