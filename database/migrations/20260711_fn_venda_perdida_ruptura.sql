-- Venda perdida por ruptura: cruza produtos em ruptura INTERMITENTE
-- (gold_..._stockout_filtrado, 1 snapshot/dia) com a velocidade de venda real
-- (gold_contahub_avendas_porproduto_analitico). Só ruptura intermitente (item normalmente
-- disponível que faltou em <=50% dos dias) — exclui ruído de cadastro (itens sem controle
-- de estoque flagados todo dia mas que vendem). Velocidade medida SÓ nos dias COM
-- disponibilidade (baseline limpo). Faixa honesta:
--   conservador = Σ max(0, vel_disponivel - vendas_reais_no_dia_ruptura) * preço
--   teto        = Σ vel_disponivel * preço
-- Consumido por /api/operacional/venda-perdida-ruptura (rpc via service_role).
CREATE OR REPLACE FUNCTION operations.fn_venda_perdida_ruptura(
  p_bar_id int,
  p_dias   int DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO operations, gold, public, pg_catalog
AS $$
  WITH params AS (SELECT (CURRENT_DATE - p_dias)::date AS di, GREATEST(1, p_dias/2) AS max_rup),
  vendas_dia AS (
    SELECT a.prd, a.trn_dtgerencial AS dia, sum(a.qtd) AS un
    FROM gold.gold_contahub_avendas_porproduto_analitico a, params
    WHERE a.bar_id = p_bar_id AND a.trn_dtgerencial >= params.di AND a.valorfinal > 0
    GROUP BY a.prd, a.trn_dtgerencial
  ),
  rup AS (
    SELECT f.prd, f.data_consulta AS dia, max(f.prd_precovenda) AS preco,
           max(f.prd_desc) AS prd_desc, max(f.categoria_mix) AS categoria
    FROM gold.gold_contahub_operacional_stockout_filtrado f, params
    WHERE f.bar_id = p_bar_id AND f.data_consulta >= params.di
    GROUP BY f.prd, f.data_consulta
  ),
  rup_meta AS (
    SELECT prd, count(*) AS dias_rup, max(preco) AS preco,
           max(prd_desc) AS prd_desc, max(categoria) AS categoria
    FROM rup GROUP BY prd
  ),
  vel_avail AS (  -- velocidade só nos dias SEM ruptura
    SELECT vd.prd, avg(vd.un) AS v
    FROM vendas_dia vd
    LEFT JOIN rup r ON r.prd = vd.prd AND r.dia = vd.dia
    WHERE r.prd IS NULL
    GROUP BY vd.prd
  ),
  perda AS (
    SELECT r.prd, r.dia, rm.preco, rm.prd_desc, rm.categoria, va.v,
           GREATEST(0, va.v - COALESCE(vd.un,0)) * rm.preco AS conservador,
           va.v * rm.preco AS teto
    FROM rup r
    JOIN rup_meta rm ON rm.prd = r.prd
    JOIN vel_avail va ON va.prd = r.prd
    LEFT JOIN vendas_dia vd ON vd.prd = r.prd AND vd.dia = r.dia
    WHERE rm.dias_rup BETWEEN 1 AND (SELECT max_rup FROM params)
      AND va.v > 0 AND rm.preco > 0
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
        'conservador', round(sum(conservador),0),
        'teto', round(sum(teto),0),
        'produtos', count(DISTINCT prd),
        'ocorrencias', count(*)
      ) FROM perda),
    'por_produto', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.teto DESC),'[]'::jsonb) FROM (
        SELECT prd_desc AS produto, count(*) AS dias_ruptura,
               round(max(preco),2) AS preco, round(max(v),1) AS vel_dia,
               round(sum(conservador),0) AS conservador, round(sum(teto),0) AS teto
        FROM perda GROUP BY prd_desc ORDER BY teto DESC LIMIT 20) x),
    'por_categoria', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.teto DESC),'[]'::jsonb) FROM (
        SELECT COALESCE(NULLIF(categoria,''),'—') AS categoria,
               round(sum(conservador),0) AS conservador, round(sum(teto),0) AS teto
        FROM perda GROUP BY 1) x),
    'por_dia', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.dia),'[]'::jsonb) FROM (
        SELECT dia::text AS dia, round(sum(conservador),0) AS conservador, round(sum(teto),0) AS teto
        FROM perda GROUP BY dia) x),
    'meta', jsonb_build_object('dias',p_dias,'desde',(CURRENT_DATE-p_dias)::text,
        'modelo','ruptura intermitente; velocidade dos dias com disponibilidade')
  );
$$;

REVOKE ALL ON FUNCTION operations.fn_venda_perdida_ruptura(int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_venda_perdida_ruptura(int,int) TO service_role;
