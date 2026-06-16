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
-- Corpo final aplicado em apply_migration get_balanco_ca_v7_cmc_despesa. Assinatura:
--   public.get_balanco_ca(p_bar_id integer, p_ano integer, p_mes integer)
-- Retorna receita_liquida, lucro_liquido, cmv, cmc, contas_receber, pc_* (blocos do
-- passivo circulante em aberto), pc_total_despesas, dividendos_pagos.
--
-- Calibrado contra a planilha (maio/Ordi) — bate na vírgula em receita, lucro, CMV,
-- contas a receber, artistas, fornecedores CMV, adm&mkt, ocupação, CMO, investimentos,
-- impostos e PASSIVO CIRCULANTE TOTAL. Regras-chave da calibração:
--   * receita/lucro/CMV com SINAL (RECEITA +, DESPESA −); CMV = |soma do macro|.
--   * todos os blocos usam valor efetivo = COALESCE(NULLIF(valor_pago,0), valor_bruto).
--   * CMC = Custo Comida+Bebidas+Drinks SÓ tipo='DESPESA' (exclui estornos lançados
--     como RECEITA). Fórmula da planilha soma o macro "Custo insumos (CMV)" inteiro.
--   * Investimentos = macro 'Investimentos' EXCETO '[Investimento] Investimento Inicial
--     Abertura do Bar' (esse cai em Outras Contas a Pagar).
--   * Passivo Circulante (total_desp) EXCLUI PROVISÃO TRABALHISTA e PROVISÃO FISCAL —
--     viram provisões à parte (manuais) no Passivo Não Circulante.
-- Diferenças residuais conhecidas (~1k): CMC e Despesas Operacionais. Causa: a planilha
-- usa data_pagamento real na regra "em aberto"; o bronze tem data_pagamento NULA, então
-- usamos data_vencimento como proxy (bate em quase tudo, diverge nesses dois blocos).
