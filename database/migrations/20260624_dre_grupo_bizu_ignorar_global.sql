-- "Despesas Grupo Bizu" não entra na DRE de NENHUM bar (decisão sócio 24/06).
-- Antes era override só do bar 4; agora o de-para global vai pra IGNORAR (a RPC
-- get_dre_por_ano exclui IGNORAR de lançamentos e da linha-zero). DFC não é afetada
-- (usa meta.categoria_dfc_map, onde Grupo Bizu segue como AJUSTE).

update financial.dre_categoria_macro
   set categoria_macro = 'IGNORAR', ordem_macro = 99, ordem_sub = 99
 where bar_id is null and public.normcat(categoria_nome) = public.normcat('Despesas Grupo Bizu');

delete from financial.dre_categoria_macro
 where bar_id = 4 and public.normcat(categoria_nome) = public.normcat('Despesas Grupo Bizu');