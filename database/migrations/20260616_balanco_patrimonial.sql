-- 2026-06-16 — Balanço Patrimonial (Financeiro → Balanço). Ver spec em memória
-- project_balanco_patrimonial_spec. Foto do dia 31: "em aberto" = competência <= fim
-- do mês E data_vencimento > fim do mês (data_pagamento é nula no bronze).
--
-- Tabela de inputs manuais (azul):
CREATE TABLE IF NOT EXISTS financial.balanco_manual (
  bar_id integer NOT NULL, ano integer NOT NULL, mes integer NOT NULL,
  caixa_investimentos numeric DEFAULT 0, emprestimos_cp_receber numeric DEFAULT 0, estoques numeric DEFAULT 0,
  imobilizado_inicial numeric DEFAULT 0, imobilizado_liq numeric DEFAULT 0,
  investimentos_aprovados_a_fazer numeric DEFAULT 0, financiamentos_lp numeric DEFAULT 0,
  provisoes_fiscais_eventos numeric DEFAULT 0, provisoes_trabalhistas numeric DEFAULT 0,
  patrimonio_liquido numeric DEFAULT 0, investimentos_aprovados numeric DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(), PRIMARY KEY (bar_id, ano, mes)
);
GRANT SELECT, INSERT, UPDATE ON financial.balanco_manual TO authenticated, service_role;

-- Função das linhas do Conta Azul (laranja): topo (DRE do mês) + snapshot em aberto.
-- Corpo aplicado em apply_migration get_balanco_ca_v3_vencimento. Assinatura:
--   public.get_balanco_ca(p_bar_id integer, p_ano integer, p_mes integer)
-- Retorna receita_liquida, lucro_liquido, cmv, cmc, contas_receber, pc_* (blocos do
-- passivo circulante em aberto), pc_total_despesas, dividendos_pagos.
