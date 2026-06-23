-- Orçamentação · Despesas Administrativas
-- Bar 4 (Deboche): a linha "administrativo local" passa a se chamar
-- "Administrativo Deboche" (bar 3 = "Administrativo Ordinário", inalterado).
-- Os lançamentos manuais (plan/proj) do bar 4 estavam salvos sob
-- "Administrativo Ordinário" — migra pra nova chave pra não perder os valores.
-- O realizado continua vindo do gold (categorias 'Administrativo Ordinário' +
-- 'Administrativo Local'), independente do nome de exibição.
-- Ver: orcamentacao-service.ts (nomePorBar { 4: 'Administrativo Deboche' }).
update orcamento_planilha
   set categoria_nome = 'Administrativo Deboche'
 where bar_id = 4
   and categoria_nome = 'Administrativo Ordinário'
   and not exists (
     select 1 from orcamento_planilha b
      where b.bar_id = orcamento_planilha.bar_id
        and b.ano   = orcamento_planilha.ano
        and b.mes   = orcamento_planilha.mes
        and b.categoria_nome = 'Administrativo Deboche'
   );
