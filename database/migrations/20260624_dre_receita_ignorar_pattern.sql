-- "Outras Receitas" do Conta Azul continha movimentação financeira (transferência,
-- investimento, depósito do próprio caixa, intercompany) tagueada como RECEITA, inflando
-- a DRE (Deboche 2025 chegou a ~R$1mi/mês; real ~R$300-480k). Filtro CIRÚRGICO por descrição,
-- editável (não hardcoded no RPC). Aplicado em public.get_dre_por_ano e financial.get_dre_lancamentos
-- via NOT EXISTS (ver migration 20260624_dre_aplica_ignorar_pattern_rpcs).

create table if not exists financial.dre_receita_ignorar_pattern (
  id            bigint generated always as identity primary key,
  bar_id        integer,                 -- null = vale p/ os dois bares
  categoria_nome text not null,
  pattern       text not null,           -- ILIKE contra a descricao do lançamento
  motivo        text,
  criado_em     timestamptz not null default now()
);

comment on table financial.dre_receita_ignorar_pattern is
  'Padrões de descrição p/ excluir lançamentos NÃO-operacionais da DRE (movimentação financeira tagueada como RECEITA no CA). Editável; usado por get_dre_por_ano e get_dre_lancamentos.';

grant select on financial.dre_receita_ignorar_pattern to anon, authenticated, service_role;

insert into financial.dre_receita_ignorar_pattern (bar_id, categoria_nome, pattern, motivo) values
  (null, 'Outras Receitas', '%transfer%',            'Transferência entre contas/empresas do grupo'),
  (null, 'Outras Receitas', 'ted %',                 'TED (transferência bancária)'),
  (null, 'Outras Receitas', '%rende f%cil%',         'Investimento BB Rende Fácil'),
  (null, 'Outras Receitas', '%aplica%',              'Aplicação em investimento'),
  (null, 'Outras Receitas', '%resgate%',             'Resgate de investimento'),
  (null, 'Outras Receitas', '%cdb%',                 'Investimento CDB'),
  (null, 'Outras Receitas', 'pix recebido%',         'PIX intercompany (Descubra/Ordinário)'),
  (null, 'Outras Receitas', 'pix - enviado%',        'PIX enviado (saída lançada como receita)'),
  (null, 'Outras Receitas', '%dep dinheiro atm%',    'Depósito do próprio caixa em ATM (venda já contada em Dinheiro)'),
  (null, 'Outras Receitas', '%dep%sito por bol%',    'Depósito por boleto na própria conta (Inter)'),
  (null, 'Outras Receitas', '%distribui%lucro%',     'Distribuição de lucro / compensação de dívida intercompany'),
  (null, 'Outras Receitas', 'origem:%destino:%',     'Transferência interna (caixa->banco)'),
  (null, 'Outras Receitas', 'estorno%',              'Estorno / reversão'),
  (null, 'Outras Receitas', '%restitui%',            'Restituição de imposto (não-operacional)')
on conflict do nothing;
