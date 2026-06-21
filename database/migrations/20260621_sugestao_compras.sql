-- 2026-06-21 — Protótipo de Sugestão de Compras (base do reorder/par-level).
-- estoque atual (última contagem) + consumo/dia (histórico de contagens) × dias de cobertura − estoque = comprar.
-- Exclui categoria 'Produção' (preparos feitos na cozinha, não comprados).
-- Depende: contagem fresca + custo/unidade/embalagem do insumo 1000% (em andamento — ver [[project_insumos_cadastro_planilha_mestre]]).
CREATE OR REPLACE FUNCTION operations.sugestao_compras(p_bar_id int, p_tipo_local text, p_cobertura_dias int DEFAULT 7)
RETURNS TABLE(nome text, categoria text, unidade text, custo numeric, estoque_atual numeric, ultima_contagem date,
              consumo_dia numeric, necessidade numeric, sugestao_comprar numeric, valor_estimado numeric)
LANGUAGE sql STABLE SET search_path TO 'operations','pg_catalog' AS $$
  WITH seq AS (
    SELECT insumo_codigo, data_contagem, estoque_final,
      LAG(estoque_final) OVER w AS prev_final, LAG(data_contagem) OVER w AS prev_data
    FROM operations.contagem_estoque_insumos WHERE bar_id=p_bar_id
    WINDOW w AS (PARTITION BY insumo_codigo ORDER BY data_contagem)
  ),
  consumo AS (
    SELECT insumo_codigo, (prev_final-estoque_final)::numeric/GREATEST((data_contagem-prev_data),1) AS consumo_dia
    FROM seq WHERE prev_final IS NOT NULL AND (prev_final-estoque_final) > 0 AND data_contagem >= current_date - 60
  ),
  rate AS (SELECT insumo_codigo, avg(consumo_dia) media_dia FROM consumo GROUP BY 1),
  atual AS (SELECT DISTINCT ON (insumo_codigo) insumo_codigo, estoque_final, data_contagem
            FROM operations.contagem_estoque_insumos WHERE bar_id=p_bar_id ORDER BY insumo_codigo, data_contagem DESC)
  SELECT i.nome::text, i.categoria::text, i.unidade_medida::text, i.custo_unitario,
    a.estoque_final, a.data_contagem, round(r.media_dia,2),
    round(r.media_dia*p_cobertura_dias,2),
    round(r.media_dia*p_cobertura_dias - COALESCE(a.estoque_final,0),2),
    round((r.media_dia*p_cobertura_dias - COALESCE(a.estoque_final,0))*COALESCE(i.custo_unitario,0),2)
  FROM operations.insumos i
  JOIN atual a ON a.insumo_codigo=i.codigo
  JOIN rate r ON r.insumo_codigo=i.codigo
  WHERE i.bar_id=p_bar_id AND i.ativo=true AND i.tipo_local=p_tipo_local
    AND COALESCE(i.categoria,'') <> 'Produção'
    AND r.media_dia*p_cobertura_dias > COALESCE(a.estoque_final,0)
  ORDER BY (r.media_dia*p_cobertura_dias - COALESCE(a.estoque_final,0))*COALESCE(i.custo_unitario,0) DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION operations.sugestao_compras(int, text, int) TO anon, authenticated, service_role;
