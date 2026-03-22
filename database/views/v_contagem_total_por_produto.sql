-- View: v_contagem_total_por_produto
CREATE OR REPLACE VIEW public.v_contagem_total_por_produto AS
 SELECT c.bar_id, c.categoria, c.descricao, c.data_contagem, max(c.preco) AS preco, count(DISTINCT c.area_id) AS total_areas, sum(c.estoque_fechado) AS estoque_fechado_total, sum(c.estoque_flutuante) AS estoque_flutuante_total, sum(c.estoque_total) AS estoque_total, sum(c.valor_total) AS valor_total, string_agg(DISTINCT (a.nome)::text, ', ' ORDER BY (a.nome)::text) AS areas
   FROM (contagem_estoque_produtos c LEFT JOIN areas_contagem a ON (c.area_id = a.id)) GROUP BY c.bar_id, c.categoria, c.descricao, c.data_contagem;
