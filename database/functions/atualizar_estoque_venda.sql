-- Função: atualizar_estoque_venda (trigger)
CREATE OR REPLACE FUNCTION public.atualizar_estoque_venda() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_produto RECORD;
BEGIN
  SELECT * INTO v_produto FROM produtos WHERE id = NEW.produto_id;
  IF v_produto.controla_estoque THEN
    INSERT INTO estoque_movimentacoes (empresa_id, produto_id, tipo, quantidade, estoque_anterior, estoque_posterior, comanda_id) VALUES (v_produto.empresa_id, NEW.produto_id, 'venda', NEW.quantidade, v_produto.estoque_atual, v_produto.estoque_atual - NEW.quantidade, NEW.comanda_id);
    UPDATE produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
    IF (v_produto.estoque_atual - NEW.quantidade) <= v_produto.estoque_minimo AND v_produto.alerta_estoque_baixo THEN
      INSERT INTO estoque_alertas (empresa_id, produto_id, tipo, mensagem) VALUES (v_produto.empresa_id, NEW.produto_id, CASE WHEN (v_produto.estoque_atual - NEW.quantidade) <= 0 THEN 'estoque_zerado' ELSE 'estoque_baixo' END, 'Produto com estoque baixo');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
