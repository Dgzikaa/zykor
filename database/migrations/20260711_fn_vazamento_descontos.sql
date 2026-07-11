-- Vazamento (descontos): consolida o desconto dado por operador/categoria/dia/item a partir
-- de gold_contahub_avendas_porproduto_analitico. Só vendas reais (valorfinal>0). Cortesia/consumo
-- interno fica no módulo de Consumação (evita dupla contagem).
-- Consumido por /api/operacional/vazamento-descontos (rpc via service_role).
CREATE OR REPLACE FUNCTION operations.fn_vazamento_descontos(
  p_bar_id int,
  p_dias   int DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO operations, gold, public, pg_catalog
AS $$
  WITH base AS (
    SELECT a.usr_lancou AS operador, a.grp_desc AS categoria, a.prd_desc AS produto,
           a.trn_dtgerencial AS dia, a.valorfinal, a.desconto,
           (a.trn_dtgerencial::text || '|' || NULLIF(a.vd_mesadesc,'')) AS comanda
    FROM gold.gold_contahub_avendas_porproduto_analitico a
    WHERE a.bar_id = p_bar_id AND a.trn_dtgerencial >= CURRENT_DATE - p_dias
      AND a.valorfinal > 0
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT jsonb_build_object(
        'desconto_total', round(sum(desconto),0),
        'vendas', round(sum(valorfinal),0),
        'desconto_pct', round(100.0*sum(desconto)/NULLIF(sum(valorfinal)+sum(desconto),0),1),
        'comandas_com_desconto', count(DISTINCT comanda) FILTER (WHERE desconto > 0),
        'itens_com_desconto', count(*) FILTER (WHERE desconto > 0)
      ) FROM base),
    'por_operador', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.desconto DESC),'[]'::jsonb) FROM (
        SELECT operador, round(sum(desconto),0) AS desconto,
               round(100.0*sum(desconto)/NULLIF(sum(valorfinal)+sum(desconto),0),1) AS desconto_pct,
               round(sum(valorfinal),0) AS vendas
        FROM base GROUP BY operador HAVING sum(desconto) > 0
        ORDER BY sum(desconto) DESC LIMIT 25) x),
    'por_categoria', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.desconto DESC),'[]'::jsonb) FROM (
        SELECT COALESCE(NULLIF(categoria,''),'—') AS categoria, round(sum(desconto),0) AS desconto,
               round(100.0*sum(desconto)/NULLIF(sum(valorfinal)+sum(desconto),0),1) AS desconto_pct
        FROM base GROUP BY 1 HAVING sum(desconto) > 0 ORDER BY sum(desconto) DESC LIMIT 15) x),
    'por_dia', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.dia),'[]'::jsonb) FROM (
        SELECT dia::text AS dia, round(sum(desconto),0) AS desconto,
               round(100.0*sum(desconto)/NULLIF(sum(valorfinal)+sum(desconto),0),1) AS desconto_pct
        FROM base GROUP BY dia) x),
    'top_itens', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.desconto DESC),'[]'::jsonb) FROM (
        SELECT produto, count(*) FILTER (WHERE desconto>0) AS ocorrencias,
               round(sum(desconto),0) AS desconto
        FROM base GROUP BY produto HAVING sum(desconto) > 0 ORDER BY sum(desconto) DESC LIMIT 15) x),
    'meta', jsonb_build_object('dias',p_dias,'desde',(CURRENT_DATE-p_dias)::text)
  );
$$;

REVOKE ALL ON FUNCTION operations.fn_vazamento_descontos(int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_vazamento_descontos(int,int) TO service_role;
