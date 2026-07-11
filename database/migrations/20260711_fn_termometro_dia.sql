-- Termômetro do dia: compara os sinais de um dia contra a MEDIANA das últimas 6 ocorrências
-- do MESMO dia da semana (bar tem sazonalidade forte por dia — comparar com "ontem" engana).
-- Sinais: faturamento, clientes, ticket (operations.eventos_base), % desconto
-- (gold_contahub_avendas_porproduto_analitico), ruptura (gold_..._stockout_filtrado).
-- dir='maior' (maior=melhor) ou 'menor' (menor=melhor). O front colore por dir + magnitude.
-- Consumido por /api/operacional/termometro (página em Ferramentas). rpc service_role.
CREATE OR REPLACE FUNCTION operations.fn_termometro_dia(
  p_bar_id int,
  p_data   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO operations, gold, public, pg_catalog
AS $$
  WITH alvo AS (SELECT COALESCE(p_data, CURRENT_DATE - 1) AS d),
  dias_base AS (
    SELECT eb.data_evento AS d
    FROM operations.eventos_base eb, alvo
    WHERE eb.bar_id = p_bar_id AND eb.real_r > 0 AND eb.data_evento < alvo.d
      AND extract(dow FROM eb.data_evento) = extract(dow FROM alvo.d)
    ORDER BY eb.data_evento DESC LIMIT 6
  ),
  dias AS (SELECT d FROM alvo UNION SELECT d FROM dias_base),
  ev AS (
    SELECT eb.data_evento AS d, eb.real_r AS fat, eb.cl_real AS cli,
           CASE WHEN eb.cl_real > 0 THEN eb.real_r/eb.cl_real ELSE NULL END AS ticket
    FROM operations.eventos_base eb JOIN dias ON dias.d = eb.data_evento
    WHERE eb.bar_id = p_bar_id
  ),
  desc_dia AS (
    SELECT a.trn_dtgerencial AS d,
           100.0*sum(a.desconto)/NULLIF(sum(a.valorfinal)+sum(a.desconto),0) AS desc_pct
    FROM gold.gold_contahub_avendas_porproduto_analitico a JOIN dias ON dias.d = a.trn_dtgerencial
    WHERE a.bar_id = p_bar_id AND a.valorfinal > 0 GROUP BY 1
  ),
  rup_dia AS (
    SELECT f.data_consulta AS d, count(DISTINCT f.prd) AS ruptura
    FROM gold.gold_contahub_operacional_stockout_filtrado f JOIN dias ON dias.d = f.data_consulta
    WHERE f.bar_id = p_bar_id GROUP BY 1
  ),
  m AS (
    SELECT dias.d, ev.fat, ev.cli, ev.ticket, dd.desc_pct, rd.ruptura,
           (dias.d = (SELECT d FROM alvo)) AS eh_alvo
    FROM dias
    LEFT JOIN ev ON ev.d = dias.d
    LEFT JOIN desc_dia dd ON dd.d = dias.d
    LEFT JOIN rup_dia rd ON rd.d = dias.d
  ),
  a AS (SELECT * FROM m WHERE eh_alvo),
  b AS (
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY fat)      AS fat,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY cli)      AS cli,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ticket)   AS ticket,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY desc_pct) AS desc_pct,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ruptura)  AS ruptura,
      count(*) FILTER (WHERE fat IS NOT NULL) AS n
    FROM m WHERE NOT eh_alvo
  ),
  sinal AS (
    SELECT nome, fmt, dir,
           round(valor::numeric, casas) AS valor,
           round(base::numeric, casas) AS base,
           CASE WHEN base IS NULL OR base = 0 THEN NULL
                ELSE round((100.0*(valor-base)/base)::numeric,0) END AS var_pct
    FROM (VALUES
      ('Faturamento',    'brl', 'maior', (SELECT fat FROM a),      (SELECT fat FROM b),      0),
      ('Clientes',       'int', 'maior', (SELECT cli FROM a),      (SELECT cli FROM b),      0),
      ('Ticket',         'brl', 'maior', (SELECT ticket FROM a),   (SELECT ticket FROM b),   0),
      ('Desconto %',     'pct', 'menor', (SELECT desc_pct FROM a), (SELECT desc_pct FROM b), 1),
      ('Ruptura (itens)','int', 'menor', (SELECT ruptura FROM a),  (SELECT ruptura FROM b),  0)
    ) AS t(nome, fmt, dir, valor, base, casas)
  )
  SELECT jsonb_build_object(
    'data', (SELECT d FROM alvo)::text,
    'dow', extract(dow FROM (SELECT d FROM alvo))::int,
    'amostra', (SELECT n FROM b),
    'sinais', (SELECT COALESCE(jsonb_agg(to_jsonb(sinal)),'[]'::jsonb) FROM sinal)
  );
$$;

REVOKE ALL ON FUNCTION operations.fn_termometro_dia(int,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION operations.fn_termometro_dia(int,date) TO service_role;
