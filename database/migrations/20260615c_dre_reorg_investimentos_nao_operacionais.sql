-- 2026-06-15 — DRE: reorganização dos grupos Investimentos e Não Operacionais
-- conforme padronização do sócio no Conta Azul.
--
-- Investimentos: só os 5 [Investimento] (nomes "pelados" sem lançamento saíram) +
--   a variante "[Investimento] Equipamentos R" (receita) fundida na linha de
--   Equipamentos (mesmo ordem_sub -> canon exibe "[Investimento] Equipamentos"),
--   + Contratos Anuais (movida de Não Operacionais; entra na seção pós-DRE).
-- Não Operacionais: "Contratos" (genérico, sem lançamento) virou 2 linhas
--   (Contrato Cashback Mensal fica aqui; Contratos Anuais foi p/ Investimentos);
--   Despesas Financeiras movida de Investimentos p/ cá (ao lado de Receitas
--   Financeiras); Outros Sócios incluída.

-- Investimentos (rebuild limpo)
DELETE FROM financial.dre_categoria_macro WHERE categoria_macro = 'Investimentos';
INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal) VALUES
  ('[Investimento] Consultoria',                         'Investimentos', 11, 1, -1),
  ('[Investimento] Equipamentos',                        'Investimentos', 11, 2, -1),
  ('[Investimento] Equipamentos R',                      'Investimentos', 11, 2,  1),
  ('[Investimento] Investimento Inicial Abertura do Bar','Investimentos', 11, 3, -1),
  ('[Investimento] Obras',                               'Investimentos', 11, 4, -1),
  ('[Investimento] Outros Investimentos',               'Investimentos', 11, 5, -1),
  ('Contratos Anuais',                                  'Investimentos', 11, 6,  1);

-- Não Operacionais (rebuild limpo)
DELETE FROM financial.dre_categoria_macro WHERE categoria_macro = 'Não Operacionais';
INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal) VALUES
  ('Receitas Financeiras',        'Não Operacionais', 9, 1,  1),
  ('Contrato Cashback Mensal',    'Não Operacionais', 9, 2,  1),
  ('[Consumação] Relacionamento', 'Não Operacionais', 9, 4, -1),
  ('[Consumação] Sócios',         'Não Operacionais', 9, 5, -1),
  ('Outros Sócios',               'Não Operacionais', 9, 6, -1),
  ('Despesas Financeiras',        'Não Operacionais', 9, 7, -1);

-- [Manual] Ajuste Receita Virada do Mês -> Receita (match case-insensitive cobre
-- [Manual]/[MANUAL]; lançamentos receita+despesa se anulam = líquido 0).
INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal)
VALUES ('[Manual] Ajuste Receita Virada do Mês', 'Receita', 1, 8, 1)
ON CONFLICT DO NOTHING;
