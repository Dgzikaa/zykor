-- DRE: Stone Crédito, Débito e Pix viram UMA linha "Stone" (pedido do Gonza, 18/08/2026).
--
-- Não precisou mexer em função nenhuma: `public.get_dre_por_ano` já agrupa por
-- (categoria_macro, ordem_sub) e rotula a linha com `min(categoria_nome)`. Basta pôr as três no
-- mesmo `ordem_sub`.
--
-- O detalhe é o NOME da linha: com as três juntas em ordem_sub=1, o `min()` daria "Stone Crédito",
-- que é mentira (a linha soma as três). Por isso entra uma quarta linha chamada só "Stone", que
-- existe EXCLUSIVAMENTE para dar nome ao grupo — 'Stone' < 'Stone Crédito' por ser prefixo, então
-- vira o rótulo. Ela não casa com lançamento nenhum (não existe categoria "Stone" no Conta Azul),
-- e o esqueleto do RPC, que emite uma linha zerada por grupo, colapsa nela mesma.
--
-- O drill-down continua certo de graça: `financial.get_dre_lancamentos` resolve o grupo com o mesmo
-- `having min(categoria_nome) = p_categoria_canon` e depois pega TODAS as categorias daquele
-- (macro, ordem_sub) — as três da Stone entram, a guarda-chuva não tem lançamento e não atrapalha.
--
-- Conferido no bar 3: 06/2026 R$ 940.728,03 e 07/2026 R$ 1.159.836,00 na linha "Stone", idênticos
-- à soma das três categorias no bronze.
--
-- Para desfazer: devolver ordem_sub 1/2/3 às três e apagar a linha 'Stone'.

update financial.dre_categoria_macro
   set ordem_sub = 1
 where bar_id is null and categoria_nome in ('Stone Crédito','Stone Débito','Stone Pix');

insert into financial.dre_categoria_macro (bar_id, categoria_nome, categoria_macro, ordem_macro, ordem_sub)
select null, 'Stone', 'Receita', 1, 1
where not exists (select 1 from financial.dre_categoria_macro
                   where bar_id is null and categoria_nome = 'Stone');
