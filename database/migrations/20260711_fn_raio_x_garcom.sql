-- Raio-x por garçom/vendedor: agrega gold_contahub_avendas_porproduto_analitico por usr_lancou.
-- Vendas reais só (valorfinal>0 exclui Insumos/consumo interno). "comanda" = dia + mesa
-- (vd_mesadesc) — comandaorigem está vazio em ~93% e trn agrupa demais. Métricas: vendas,
-- comandas, ticket médio (R$/mesa atendida), itens/comanda, desconto %, attach de bebida.
-- Consumido por /api/operacional/raio-x-garcom (rpc via service_role).
CREATE OR REPLACE FUNCTION operations.fn_raio_x_garcom(
  p_bar_id       int,
  p_dias         int DEFAULT 30,
  p_min_comandas int DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO operations, gold, public, pg_catalog
AS $$
  WITH base AS (
    SELECT
      a.usr_lancou AS garcom,
      (a.trn_dtgerencial::text || '|' || NULLIF(a.vd_mesadesc,'')) AS comanda,  -- NULL se sem mesa
      a.valorfinal, a.desconto, a.qtd,
      (a.grp_desc ~* '(cerveja|bebida|drink|dose|balde|chopp|happy|shot|preshh|montado|mexido|batido)') AS eh_bebida
    FROM gold.gold_contahub_avendas_porproduto_analitico a
    WHERE a.bar_id = p_bar_id
      AND a.trn_dtgerencial >= CURRENT_DATE - p_dias
      AND a.valorfinal > 0
      AND a.usr_lancou IS NOT NULL AND a.usr_lancou <> ''
  ),
  por_garcom AS (
    SELECT
      garcom,
      count(DISTINCT comanda) AS comandas,
      sum(valorfinal) AS vendas,
      sum(qtd) AS itens,
      sum(desconto) AS desconto,
      count(DISTINCT comanda) FILTER (WHERE eh_bebida) AS comandas_com_bebida,
      sum(valorfinal) FILTER (WHERE eh_bebida) AS vendas_bebida
    FROM base GROUP BY garcom
  )
  SELECT jsonb_build_object(
    'casa', (SELECT jsonb_build_object(
        'vendas', round(sum(valorfinal),0),
        'comandas', count(DISTINCT comanda),
        'ticket_medio', round(sum(valorfinal)/NULLIF(count(DISTINCT comanda),0),2),
        'itens_por_comanda', round(sum(qtd)/NULLIF(count(DISTINCT comanda),0),1),
        'desconto_pct', round(100.0*sum(desconto)/NULLIF(sum(valorfinal)+sum(desconto),0),1)
      ) FROM base),
    'garcons', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.vendas DESC),'[]'::jsonb) FROM (
        SELECT garcom,
               round(vendas,0) AS vendas,
               comandas,
               round(itens,0) AS itens,
               round(vendas/NULLIF(comandas,0),2) AS ticket_medio,
               round(itens/NULLIF(comandas,0),1) AS itens_por_comanda,
               round(desconto,0) AS desconto,
               round(100.0*desconto/NULLIF(vendas+desconto,0),1) AS desconto_pct,
               round(100.0*comandas_com_bebida/NULLIF(comandas,0),0) AS bebida_attach_pct,
               round(100.0*vendas_bebida/NULLIF(vendas,0),0) AS bebida_vendas_pct
        FROM por_garcom WHERE comandas >= p_min_comandas) x),
    'meta', jsonb_build_object('dias',p_dias,'min_comandas',p_min_comandas,'desde',(CURRENT_DATE-p_dias)::text)
  );
$$;

REVOKE ALL ON FUNCTION operations.fn_raio_x_garcom(int,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_raio_x_garcom(int,int,int) TO service_role;
