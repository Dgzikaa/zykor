-- View: v_resumo_por_area
CREATE OR REPLACE VIEW public.v_resumo_por_area AS
 SELECT a.id AS area_id, a.nome AS area_nome, a.tipo AS area_tipo, a.ativo, c.data_contagem, count(DISTINCT c.id) AS total_itens, count(DISTINCT c.categoria) AS total_categorias, sum(c.estoque_total) AS estoque_total, sum(c.valor_total) AS valor_total, min(c.created_at) AS primeira_contagem, max(c.created_at) AS ultima_contagem
   FROM (areas_contagem a LEFT JOIN contagem_estoque_produtos c ON (a.id = c.area_id)) GROUP BY a.id, a.nome, a.tipo, a.ativo, c.data_contagem ORDER BY a.nome;
