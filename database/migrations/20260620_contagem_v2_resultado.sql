-- 2026-06-20 — Contagem v2: esperado × contado (perda) + correção de chave.
-- BUG achado: as contagens do Sheets têm insumo_id NULL — o vínculo real cadastro↔contagem
-- é o insumo_codigo. As 3 funções foram refeitas chaveando por CÓDIGO.
-- contagem_resultado: consumo do período (final anterior − contado) + esperado (taxa diária
-- histórica × dias do período, normaliza diária vs semanal) + flag anômalo (>1,5× esperado).
-- valor usa custo do cadastro como fallback (por isso preencher os 237 sem custo importa).

CREATE OR REPLACE FUNCTION operations.contagem_lista(p_bar_id int, p_tipo_local text, p_data date)
RETURNS TABLE(insumo_id bigint, codigo text, nome text, categoria text, unidade_medida text, custo_unitario numeric, ultimo_final numeric, contado numeric)
LANGUAGE sql STABLE SET search_path TO 'operations','pg_catalog' AS $$
  SELECT i.id, i.codigo::text, i.nome::text, i.categoria::text, i.unidade_medida::text, i.custo_unitario,
    (SELECT c.estoque_final FROM operations.contagem_estoque_insumos c
      WHERE c.bar_id=p_bar_id AND c.insumo_codigo=i.codigo AND c.data_contagem < p_data ORDER BY c.data_contagem DESC LIMIT 1),
    (SELECT c.estoque_final FROM operations.contagem_estoque_insumos c
      WHERE c.bar_id=p_bar_id AND c.insumo_codigo=i.codigo AND c.data_contagem = p_data LIMIT 1)
  FROM operations.insumos i
  WHERE i.bar_id=p_bar_id AND i.ativo=true AND i.tipo_local=p_tipo_local
  ORDER BY i.categoria NULLS LAST, i.nome;
$$;

CREATE OR REPLACE FUNCTION operations.contagem_salvar(p_bar_id int, p_data date, p_usuario text, p_itens jsonb)
RETURNS int LANGUAGE plpgsql SET search_path TO 'operations','pg_catalog' AS $$
DECLARE r jsonb; v_ins bigint; v_n int := 0; v_ini numeric; v_final numeric;
        v_custo numeric; v_cat text; v_loc text; v_un text; v_cod text; v_nome text;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_ins := (r->>'insumo_id')::bigint; v_final := (r->>'estoque_final')::numeric;
    SELECT codigo, nome, categoria, tipo_local, unidade_medida, custo_unitario
      INTO v_cod, v_nome, v_cat, v_loc, v_un, v_custo FROM operations.insumos WHERE id=v_ins;
    SELECT estoque_final INTO v_ini FROM operations.contagem_estoque_insumos
      WHERE bar_id=p_bar_id AND insumo_codigo=v_cod AND data_contagem < p_data ORDER BY data_contagem DESC LIMIT 1;
    v_ini := COALESCE(v_ini, 0);
    UPDATE operations.contagem_estoque_insumos
      SET estoque_final=v_final, estoque_inicial=v_ini, consumo_periodo=v_ini - v_final,
          valor_consumo=(v_ini - v_final)*COALESCE(v_custo,0), observacoes=r->>'observacoes',
          insumo_id=v_ins, usuario_contagem=p_usuario, updated_at=now()
      WHERE bar_id=p_bar_id AND insumo_codigo=v_cod AND data_contagem=p_data;
    IF NOT FOUND THEN
      INSERT INTO operations.contagem_estoque_insumos
        (bar_id, data_contagem, insumo_id, insumo_codigo, insumo_nome, estoque_inicial, estoque_final,
         consumo_periodo, valor_consumo, tipo_local, categoria, unidade_medida, custo_unitario, observacoes, usuario_contagem, created_at, updated_at)
      VALUES (p_bar_id, p_data, v_ins, v_cod, v_nome, v_ini, v_final, v_ini - v_final,
         (v_ini - v_final)*COALESCE(v_custo,0), v_loc, v_cat, v_un, v_custo, r->>'observacoes', p_usuario, now(), now());
    END IF;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;$$;

DROP FUNCTION IF EXISTS operations.contagem_resultado(integer, date);
CREATE FUNCTION operations.contagem_resultado(p_bar_id int, p_data date)
RETURNS TABLE(codigo text, nome text, categoria text, unidade text, anterior numeric, contado numeric,
              consumo numeric, valor_consumo numeric, esperado numeric, variacao_pct numeric, anomalo boolean)
LANGUAGE sql STABLE SET search_path TO 'operations','pg_catalog' AS $$
  WITH seq AS (
    SELECT insumo_codigo, insumo_nome, categoria, unidade_medida, custo_unitario, data_contagem, estoque_final,
           LAG(estoque_final) OVER w AS prev_final, LAG(data_contagem) OVER w AS prev_data
    FROM operations.contagem_estoque_insumos WHERE bar_id=p_bar_id AND data_contagem <= p_data
    WINDOW w AS (PARTITION BY insumo_codigo ORDER BY data_contagem)
  ),
  consumo AS (
    SELECT *, (prev_final - estoque_final) AS consumo, GREATEST((data_contagem - prev_data),1) AS dias,
           (prev_final - estoque_final)::numeric / GREATEST((data_contagem - prev_data),1) AS consumo_dia
    FROM seq WHERE prev_final IS NOT NULL
  ),
  hist AS (SELECT insumo_codigo, avg(consumo_dia) media_dia FROM consumo WHERE data_contagem < p_data AND consumo > 0 GROUP BY insumo_codigo)
  SELECT c.insumo_codigo::text, c.insumo_nome::text, c.categoria::text, c.unidade_medida::text,
    c.prev_final, c.estoque_final, c.consumo,
    round(c.consumo * COALESCE(NULLIF(c.custo_unitario,0), i.custo_unitario, 0), 2),
    round(h.media_dia * c.dias, 2),
    CASE WHEN h.media_dia*c.dias > 0 THEN round((c.consumo - h.media_dia*c.dias)/(h.media_dia*c.dias)*100,0) END,
    (h.media_dia IS NOT NULL AND h.media_dia*c.dias > 0 AND c.consumo > h.media_dia*c.dias*1.5 AND c.consumo - h.media_dia*c.dias > 1)
  FROM consumo c
  LEFT JOIN operations.insumos i ON i.bar_id=p_bar_id AND i.codigo=c.insumo_codigo
  LEFT JOIN hist h ON h.insumo_codigo=c.insumo_codigo
  WHERE c.data_contagem = p_data
  ORDER BY (c.consumo * COALESCE(NULLIF(c.custo_unitario,0), i.custo_unitario, 0)) DESC NULLS LAST;
$$;
