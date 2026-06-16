-- 2026-06-16 — Visão Geral: indicadores reais.
-- Clientes Ativos = MÉDIA dos meses do trimestre; "ativo" do mês = cliente (por
-- TELEFONE) com >= 2 visitas nos últimos 90 dias. (Antes: COUNT DISTINCT nome em
-- 90d = 22k; agora ~5,1k — bate com abr 5.134 / mai 5.459.)
CREATE OR REPLACE FUNCTION public.get_clientes_ativos_media_trimestre(p_bar_id integer, p_trimestre integer, p_ano integer)
 RETURNS TABLE(ativos numeric, ativos_ant numeric, variacao numeric)
 LANGUAGE sql STABLE
 SET search_path TO 'public', 'silver', 'pg_catalog'
AS $function$
  WITH params AS (
    SELECT (p_trimestre-1)*3+1 AS mes_ini, p_trimestre*3 AS mes_fim, p_ano AS ano,
           CASE WHEN p_trimestre=1 THEN 4 ELSE p_trimestre-1 END AS trim_ant,
           CASE WHEN p_trimestre=1 THEN p_ano-1 ELSE p_ano END AS ano_ant
  ),
  meses AS (
    SELECT p.ano AS ano, g AS mes, 'atual' AS bloco,
      LEAST((make_date(p.ano, g, 1) + INTERVAL '1 month - 1 day')::date, CURRENT_DATE) AS ref
    FROM params p, generate_series((SELECT mes_ini FROM params), (SELECT mes_fim FROM params)) g
    WHERE make_date(p.ano, g, 1) <= CURRENT_DATE
    UNION ALL
    SELECT p.ano_ant, g, 'ant',
      LEAST((make_date(p.ano_ant, g, 1) + INTERVAL '1 month - 1 day')::date, CURRENT_DATE)
    FROM params p, generate_series((SELECT (trim_ant-1)*3+1 FROM params), (SELECT trim_ant*3 FROM params)) g
    WHERE make_date(p.ano_ant, g, 1) <= CURRENT_DATE
  ),
  ativos_mes AS (
    SELECT m.bloco, (
      SELECT COUNT(*) FROM (
        SELECT cv.cliente_fone_norm
        FROM silver.cliente_visitas cv
        WHERE cv.bar_id = p_bar_id AND cv.tem_telefone = true
          AND cv.cliente_fone_norm IS NOT NULL AND cv.cliente_fone_norm <> ''
          AND cv.data_visita BETWEEN (m.ref - INTERVAL '89 days')::date AND m.ref
        GROUP BY cv.cliente_fone_norm
        HAVING COUNT(DISTINCT cv.data_visita) >= 2
      ) x
    ) AS cnt
    FROM meses m
  )
  SELECT
    COALESCE(ROUND(AVG(cnt) FILTER (WHERE bloco='atual')), 0)::numeric,
    COALESCE(ROUND(AVG(cnt) FILTER (WHERE bloco='ant')), 0)::numeric,
    CASE WHEN COALESCE(AVG(cnt) FILTER (WHERE bloco='ant'),0) > 0
      THEN ROUND(((AVG(cnt) FILTER (WHERE bloco='atual') / AVG(cnt) FILTER (WHERE bloco='ant')) - 1) * 100, 1)
      ELSE 0 END
  FROM ativos_mes;
$function$;
GRANT EXECUTE ON FUNCTION public.get_clientes_ativos_media_trimestre(integer,integer,integer) TO authenticated, service_role, anon;

-- Demais (na página /estrategico/visao-geral, sem mudança de schema):
--  - CMV Limpo: REAL de financial.cmv_mensal (média do trimestre), não o teórico manual.
--  - CMO: REAL de gold.cmo_produtividade_mensal.cmo_pct (média do trimestre).
--  - % Artística: (c_art+c_prod do trimestre) / faturamento_trimestre (a RPC vinha 0).
--  - Reputação: 2 casas decimais (IndicadorCard formato 'decimal').
