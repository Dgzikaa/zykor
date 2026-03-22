-- View: v_contagem_atual
CREATE OR REPLACE VIEW public.v_contagem_atual AS
 SELECT DISTINCT ON (bar_id, categoria, descricao) id, bar_id, produto_id, categoria, descricao, estoque_fechado, estoque_flutuante, estoque_total, preco, valor_total, data_contagem, variacao_percentual, alerta_variacao, alerta_preenchimento, observacoes, usuario_id, usuario_nome, created_at, updated_at
   FROM contagem_estoque_produtos ORDER BY bar_id, categoria, descricao, data_contagem DESC, created_at DESC;
