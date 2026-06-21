-- 2026-06-20 — Contagem de estoque pelo celular (v1) — fim da planilha.
-- Reusa operations.insumos (cadastro, tem tipo_local=área) + operations.contagem_estoque_insumos
-- (já existia, 216k linhas históricas do Sheets). Agora a contagem é feita no app e grava aqui direto.
-- contagem_lista: itens de uma área pra contar (com último estoque final de referência + o já contado hoje).
CREATE OR REPLACE FUNCTION operations.contagem_lista(p_bar_id int, p_tipo_local text, p_data date)
RETURNS TABLE(insumo_id bigint, codigo text, nome text, categoria text, unidade_medida text, custo_unitario numeric, ultimo_final numeric, contado numeric)
LANGUAGE sql STABLE SET search_path TO 'operations','pg_catalog' AS $$
  SELECT i.id, i.codigo::text, i.nome::text, i.categoria::text, i.unidade_medida::text, i.custo_unitario,
    (SELECT c.estoque_final FROM operations.contagem_estoque_insumos c
      WHERE c.bar_id=p_bar_id AND c.insumo_id=i.id AND c.data_contagem < p_data ORDER BY c.data_contagem DESC LIMIT 1),
    (SELECT c.estoque_final FROM operations.contagem_estoque_insumos c
      WHERE c.bar_id=p_bar_id AND c.insumo_id=i.id AND c.data_contagem = p_data LIMIT 1)
  FROM operations.insumos i
  WHERE i.bar_id=p_bar_id AND i.ativo=true AND i.tipo_local=p_tipo_local
  ORDER BY i.categoria NULLS LAST, i.nome;
$$;

-- contagem_salvar: update-else-insert por (bar,insumo,data); calcula consumo (inicial-final) e valor automático.
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
      WHERE bar_id=p_bar_id AND insumo_id=v_ins AND data_contagem < p_data ORDER BY data_contagem DESC LIMIT 1;
    v_ini := COALESCE(v_ini, 0);
    UPDATE operations.contagem_estoque_insumos
      SET estoque_final=v_final, estoque_inicial=v_ini, consumo_periodo=v_ini - v_final,
          valor_consumo=(v_ini - v_final)*COALESCE(v_custo,0), observacoes=r->>'observacoes',
          usuario_contagem=p_usuario, updated_at=now()
      WHERE bar_id=p_bar_id AND insumo_id=v_ins AND data_contagem=p_data;
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
