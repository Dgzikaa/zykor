-- Escala × produtividade: cruza gente por hora (ponto Tangerino) com venda por hora.
-- ATENÇÃO: o ponto (bronze_tangerino_punch) vem TODO taggeado bar_id=4; o bar REAL é derivado
-- do local do Tangerino (payload interessePlace 'Ordinário Bar'/'Deboche Bar'), com fallback pro
-- bar dominante do funcionário. Intervalos = dateInFull→dateOutFull (epoch ms → BRT); turno aberto
-- (sem saída) recebe +4h; descarta turno > 16h. Média por HORA-DO-DIA (não junta por data — evita
-- desalinhar o corte gerencial). Venda por hora de bronze_..._vendasdiahoraanalitico (hora "HH:00").
-- status: sobra = gente demais p/ venda (prod < 0.5×mediana e >=2 pessoas); aperto = pouca gente
-- (prod > 1.8×mediana). Consumido por /api/operacional/escala-produtividade (rpc service_role).
CREATE OR REPLACE FUNCTION operations.fn_escala_produtividade(
  p_bar_id int,
  p_dias   int DEFAULT 90
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO operations, bronze, public, pg_catalog
AS $$
  WITH local_bar AS (SELECT CASE p_bar_id WHEN 4 THEN 'Deboche Bar' ELSE 'Ordinário Bar' END AS nome),
  punch AS (
    SELECT employee_id_ext AS emp,
      COALESCE(payload->'locationIn'->'interessePlace'->>'description',
               payload->'locationOut'->'interessePlace'->>'description') AS local,
      to_timestamp((payload->>'dateInFull')::bigint/1000) AT TIME ZONE 'America/Sao_Paulo' AS t_in,
      to_timestamp((payload->>'dateOutFull')::bigint/1000) AT TIME ZONE 'America/Sao_Paulo' AS t_out
    FROM bronze.bronze_tangerino_punch WHERE payload->>'dateInFull' IS NOT NULL
  ),
  emp_bar AS (
    SELECT emp, CASE WHEN sum((local='Ordinário Bar')::int) >= sum((local='Deboche Bar')::int)
                THEN 'Ordinário Bar' ELSE 'Deboche Bar' END AS bar_dom
    FROM punch WHERE local IS NOT NULL GROUP BY emp
  ),
  pb AS (
    SELECT p.emp, COALESCE(p.local, eb.bar_dom) AS local, p.t_in,
           COALESCE(p.t_out, p.t_in + interval '4 hours') AS t_out
    FROM punch p LEFT JOIN emp_bar eb ON eb.emp = p.emp
    WHERE p.t_in >= CURRENT_DATE - p_dias
  ),
  pb2 AS (
    SELECT * FROM pb
    WHERE local = (SELECT nome FROM local_bar) AND t_out > t_in AND t_out - t_in < interval '16 hours'
  ),
  horas AS (
    SELECT emp, generate_series(date_trunc('hour',t_in), date_trunc('hour',t_out - interval '1 second'), interval '1 hour') AS h
    FROM pb2
  ),
  head AS (SELECT h::date AS dia, extract(hour from h)::int AS hora, count(DISTINCT emp) AS pessoas FROM horas GROUP BY 1,2),
  head_h AS (SELECT hora, avg(pessoas) AS pessoas FROM head GROUP BY hora),
  vendas AS (
    SELECT split_part(hora,':',1)::int AS hora, vd_dtgerencial AS dia, sum(valor) AS valor
    FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
    WHERE bar_id = p_bar_id AND vd_dtgerencial >= CURRENT_DATE - p_dias
    GROUP BY 1,2
  ),
  vendas_h AS (SELECT hora, avg(valor) AS valor FROM vendas GROUP BY hora),
  combo AS (
    SELECT COALESCE(h.hora, v.hora) AS hora,
           round(COALESCE(h.pessoas,0)::numeric,1) AS pessoas,
           round(COALESCE(v.valor,0)::numeric,0) AS vendas,
           CASE WHEN COALESCE(h.pessoas,0) > 0 THEN round((COALESCE(v.valor,0)/h.pessoas)::numeric,0) ELSE NULL END AS prod
    FROM head_h h FULL JOIN vendas_h v ON v.hora = h.hora
  ),
  med AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY prod) AS m FROM combo WHERE prod IS NOT NULL AND vendas > 0)
  SELECT jsonb_build_object(
    'por_hora', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.hora),'[]'::jsonb) FROM (
        SELECT c.hora, c.pessoas, c.vendas, c.prod,
          CASE WHEN c.prod IS NULL OR c.vendas = 0 THEN 'fechado'
               WHEN c.prod < 0.5*(SELECT m FROM med) AND c.pessoas >= 2 THEN 'sobra'
               WHEN c.prod > 1.8*(SELECT m FROM med) THEN 'aperto'
               ELSE 'ok' END AS status
        FROM combo c) x),
    'kpis', jsonb_build_object(
        'pico_gente', (SELECT jsonb_build_object('hora',hora,'pessoas',pessoas) FROM combo ORDER BY pessoas DESC LIMIT 1),
        'prod_mediana', round((SELECT m FROM med)::numeric,0),
        'horas_sobra', (SELECT count(*) FROM combo WHERE prod < 0.5*(SELECT m FROM med) AND pessoas >= 2 AND vendas > 0),
        'horas_aperto', (SELECT count(*) FROM combo WHERE prod > 1.8*(SELECT m FROM med) AND vendas > 0)
      ),
    'meta', jsonb_build_object('dias',p_dias,'bar',(SELECT nome FROM local_bar))
  );
$$;

REVOKE ALL ON FUNCTION operations.fn_escala_produtividade(int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_escala_produtividade(int,int) TO service_role;
