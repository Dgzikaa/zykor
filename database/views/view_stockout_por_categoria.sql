-- View: view_stockout_por_categoria
CREATE OR REPLACE VIEW public.view_stockout_por_categoria AS
 WITH categorias AS (SELECT contahub_stockout.data_consulta, contahub_stockout.prd_desc, contahub_stockout.loc_desc, contahub_stockout.prd_ativo, contahub_stockout.prd_venda,
   CASE WHEN (contahub_stockout.loc_desc = ANY (ARRAY['Pressh', 'Preshh', 'Montados', 'Mexido', 'Drinks', 'Drinks Autorais', 'Shot e Dose', 'Batidos'])) THEN 'Drinks' WHEN (contahub_stockout.loc_desc = ANY (ARRAY['Cozinha', 'Cozinha 1', 'Cozinha 2'])) THEN 'Cozinha' WHEN (contahub_stockout.loc_desc = ANY (ARRAY['Chopp', 'Baldes', 'Pegue e Pague', 'Venda Volante', 'Bar'])) THEN 'Bebidas' ELSE 'Outros' END AS categoria_grupo
   FROM contahub_stockout WHERE (contahub_stockout.prd_ativo = 'S'))
 SELECT data_consulta, 'GERAL' AS categoria_grupo, 1 AS ordem, count(*) AS total_produtos_ativos, count(CASE WHEN (prd_venda = 'N') THEN 1 ELSE NULL END) AS produtos_stockout, round(((count(CASE WHEN (prd_venda = 'N') THEN 1 ELSE NULL END))::numeric * 100.0) / (count(*))::numeric, 2) AS percentual_stockout
   FROM categorias GROUP BY data_consulta;
