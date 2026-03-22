-- View: v_contagem_com_historico
CREATE OR REPLACE VIEW public.v_contagem_com_historico AS
 SELECT id, bar_id, produto_id, categoria, descricao, estoque_fechado, estoque_flutuante, estoque_total, preco, valor_total, data_contagem, variacao_percentual, alerta_variacao, alerta_preenchimento, observacoes, usuario_id, usuario_nome, created_at, updated_at,
   lag(estoque_total) OVER (PARTITION BY bar_id, categoria, descricao ORDER BY data_contagem) AS estoque_anterior,
   lag(preco) OVER (PARTITION BY bar_id, categoria, descricao ORDER BY data_contagem) AS preco_anterior,
   lag(data_contagem) OVER (PARTITION BY bar_id, categoria, descricao ORDER BY data_contagem) AS data_anterior
   FROM contagem_estoque_produtos c ORDER BY data_contagem DESC;
