-- 2026-06-18 — Nova categoria "Produção Mensal Fixo" (Despesas Comerciais).
-- Categoria nova no Conta Azul (a ser criada lá pelo sócio). Mapeada no de-para da DRE
-- (Despesas Comerciais, ordem_macro=5, sub 12) e no de-para da DFC (OPERACIONAL) pra
-- não cair em "Não Mapeado" quando começar a ter lançamentos.

INSERT INTO financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal)
SELECT 'Produção Mensal Fixo','Despesas Comerciais',5,12,-1
WHERE NOT EXISTS (SELECT 1 FROM financial.dre_categoria_macro WHERE upper(btrim(categoria_nome))=upper('Produção Mensal Fixo'));

INSERT INTO meta.categoria_dfc_map (categoria_ca, grupo_dfc)
SELECT 'Produção Mensal Fixo','OPERACIONAL'
WHERE NOT EXISTS (SELECT 1 FROM meta.categoria_dfc_map WHERE upper(btrim(categoria_ca))=upper('Produção Mensal Fixo'));
