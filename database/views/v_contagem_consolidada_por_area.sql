-- View: v_contagem_consolidada_por_area
CREATE OR REPLACE VIEW public.v_contagem_consolidada_por_area AS
 SELECT c.id, c.bar_id, c.categoria, c.descricao, c.data_contagem, c.preco, a.id AS area_id, a.nome AS area_nome, a.tipo AS area_tipo, c.estoque_fechado, c.estoque_flutuante, c.estoque_total, c.valor_total, c.created_at
   FROM (contagem_estoque_produtos c LEFT JOIN areas_contagem a ON (c.area_id = a.id)) ORDER BY c.data_contagem DESC, c.categoria, c.descricao, a.nome;
