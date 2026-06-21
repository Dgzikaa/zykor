-- 2026-06-21 — Performance da contagem (timeout na cozinha após backfill).
-- 1) Índice pro lookup "último final / contado" por (bar, código): a subquery filtra
--    bar+código com range em data; o índice antigo (bar, data, código) não servia.
-- 2) contagem_lista reescrita em plpgsql com SQL DINÂMICO: a função SQL com parâmetros
--    gerava PLANO GENÉRICO que ignorava o índice (8s); inlinando os valores → plano
--    custom → usa o índice (8004ms → 22ms). p_tipo_local via %L (à prova de injection).
CREATE INDEX IF NOT EXISTS idx_contagem_bar_codigo_data
  ON operations.contagem_estoque_insumos (bar_id, insumo_codigo, data_contagem DESC);

CREATE OR REPLACE FUNCTION operations.contagem_lista(p_bar_id int, p_tipo_local text, p_data date)
RETURNS TABLE(insumo_id bigint, codigo text, nome text, categoria text, unidade_medida text, custo_unitario numeric, ultimo_final numeric, contado numeric)
LANGUAGE plpgsql STABLE SET search_path TO 'operations','pg_catalog' AS $$
BEGIN
  RETURN QUERY EXECUTE format($q$
    SELECT i.id, i.codigo::text, i.nome::text, i.categoria::text, i.unidade_medida::text, i.custo_unitario,
      (SELECT c.estoque_final FROM operations.contagem_estoque_insumos c
        WHERE c.bar_id=%1$s AND c.insumo_codigo=i.codigo AND c.data_contagem < %2$L ORDER BY c.data_contagem DESC LIMIT 1),
      (SELECT c.estoque_final FROM operations.contagem_estoque_insumos c
        WHERE c.bar_id=%1$s AND c.insumo_codigo=i.codigo AND c.data_contagem = %2$L LIMIT 1)
    FROM operations.insumos i
    WHERE i.bar_id=%1$s AND i.ativo=true AND i.tipo_local=%3$L
    ORDER BY i.categoria NULLS LAST, i.nome
  $q$, p_bar_id, p_data, p_tipo_local);
END;$$;
