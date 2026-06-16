-- 2026-06-15 — Reordena ordem_sub do de-para da DRE pra bater EXATO com a planilha
-- do sócio. Variantes de nome (acento/caixa) recebem o mesmo ordem_sub do canônico.
-- (UPDATEs idempotentes — ver corpo aplicado em apply_migration dre_ordem_planilha.)

-- Receita
UPDATE financial.dre_categoria_macro SET ordem_sub=7 WHERE categoria_macro='Receita' AND categoria_nome='[Manual] Ajuste Receita Virada do Mês';
UPDATE financial.dre_categoria_macro SET ordem_sub=8 WHERE categoria_macro='Receita' AND categoria_nome='Outras Receitas';
-- Custo insumos (CMV)
UPDATE financial.dre_categoria_macro SET ordem_sub=5 WHERE categoria_macro='Custo insumos (CMV)' AND categoria_nome='Variação de Estoque';
UPDATE financial.dre_categoria_macro SET ordem_sub=6 WHERE categoria_macro='Custo insumos (CMV)' AND categoria_nome='Ajuste Bonificações';
UPDATE financial.dre_categoria_macro SET ordem_sub=7 WHERE categoria_macro='Custo insumos (CMV)' AND categoria_nome='[Consumação] Ajuste CMV';
-- Despesas Comerciais
UPDATE financial.dre_categoria_macro SET ordem_sub=2 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Aniversários';
UPDATE financial.dre_categoria_macro SET ordem_sub=3 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Benefício Clientes';
UPDATE financial.dre_categoria_macro SET ordem_sub=4 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Influencers';
UPDATE financial.dre_categoria_macro SET ordem_sub=5 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='Atrações Programação';
UPDATE financial.dre_categoria_macro SET ordem_sub=6 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Artistas';
UPDATE financial.dre_categoria_macro SET ordem_sub=7 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='Produção Eventos';
UPDATE financial.dre_categoria_macro SET ordem_sub=8 WHERE categoria_macro='Despesas Comerciais' AND categoria_nome='[Consumação] Programa de Pontos';
-- Despesas Administrativas
UPDATE financial.dre_categoria_macro SET ordem_sub=3 WHERE categoria_macro='Despesas Administrativas' AND categoria_nome='[Consumação] Funcionários Escritório';
UPDATE financial.dre_categoria_macro SET ordem_sub=4 WHERE categoria_macro='Despesas Administrativas' AND categoria_nome='RECURSOS HUMANOS';
UPDATE financial.dre_categoria_macro SET ordem_sub=5 WHERE categoria_macro='Despesas Administrativas' AND categoria_nome='[Consumação] Funcionários Operação';
-- Despesas Operacionais
UPDATE financial.dre_categoria_macro SET ordem_sub=2 WHERE categoria_macro='Despesas Operacionais' AND categoria_nome='EQUIPAMENTOS OPERACAO';
UPDATE financial.dre_categoria_macro SET ordem_sub=3 WHERE categoria_macro='Despesas Operacionais' AND categoria_nome='ACESSORIOS SALAO';
UPDATE financial.dre_categoria_macro SET ordem_sub=4 WHERE categoria_macro='Despesas Operacionais' AND categoria_nome='LOCACOES OPERACAO';
UPDATE financial.dre_categoria_macro SET ordem_sub=5 WHERE categoria_macro='Despesas Operacionais' AND categoria_nome='Materiais de Limpeza e Descartáveis';
UPDATE financial.dre_categoria_macro SET ordem_sub=6 WHERE categoria_macro='Despesas Operacionais' AND categoria_nome IN ('Utensílios','Utensilios');
UPDATE financial.dre_categoria_macro SET ordem_sub=7 WHERE categoria_macro='Despesas Operacionais' AND categoria_nome='Estorno';
UPDATE financial.dre_categoria_macro SET ordem_sub=8 WHERE categoria_macro='Despesas Operacionais' AND categoria_nome='Outros Operação';
-- Não Operacionais
UPDATE financial.dre_categoria_macro SET ordem_sub=2 WHERE categoria_macro='Não Operacionais' AND categoria_nome='Despesas Financeiras';
UPDATE financial.dre_categoria_macro SET ordem_sub=3 WHERE categoria_macro='Não Operacionais' AND categoria_nome='[Consumação] Sócios';
UPDATE financial.dre_categoria_macro SET ordem_sub=4 WHERE categoria_macro='Não Operacionais' AND categoria_nome='[Consumação] Relacionamento';
UPDATE financial.dre_categoria_macro SET ordem_sub=5 WHERE categoria_macro='Não Operacionais' AND categoria_nome='Outros Sócios';
UPDATE financial.dre_categoria_macro SET ordem_sub=6 WHERE categoria_macro='Não Operacionais' AND categoria_nome='Contrato Cashback Mensal';
-- Investimentos
UPDATE financial.dre_categoria_macro SET ordem_sub=1 WHERE categoria_macro='Investimentos' AND categoria_nome='[Investimento] Obras';
UPDATE financial.dre_categoria_macro SET ordem_sub=2 WHERE categoria_macro='Investimentos' AND categoria_nome='[Investimento] Consultoria';
UPDATE financial.dre_categoria_macro SET ordem_sub=3 WHERE categoria_macro='Investimentos' AND categoria_nome='[Investimento] Outros Investimentos';
UPDATE financial.dre_categoria_macro SET ordem_sub=4 WHERE categoria_macro='Investimentos' AND categoria_nome IN ('[Investimento] Equipamentos','[Investimento] Equipamentos R');
UPDATE financial.dre_categoria_macro SET ordem_sub=5 WHERE categoria_macro='Investimentos' AND categoria_nome='Contratos Anuais';
UPDATE financial.dre_categoria_macro SET ordem_sub=6 WHERE categoria_macro='Investimentos' AND categoria_nome='[Investimento] Investimento Inicial Abertura do Bar';
