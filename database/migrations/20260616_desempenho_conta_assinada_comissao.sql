-- 2026-06-16 — Desempenho semanal: preenche conta_assinada (valor/%) + comissao.
-- O ETL etl_gold_desempenho_semanal (upsert) não tocava nesses 2 campos -> sempre
-- 0/null. Esta função UPDATE preenche a partir das fontes do ContaHub e persiste
-- entre runs do ETL. Cron roda logo após o gold-desempenho (12:00 UTC).
--   conta assinada: bronze_contahub_financeiro_pagamentosrecebidos (meio='Conta Assinada')
--   comissao: get_comissao_couvert_periodo (gorjeta/comissão)
CREATE OR REPLACE FUNCTION public.atualizar_conta_assinada_comissao_desempenho(p_ano integer DEFAULT NULL)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public','gold','bronze','pg_temp'
AS $function$
DECLARE v_n integer;
BEGIN
  WITH r AS (
    SELECT d.bar_id, d.ano, d.numero_semana, d.faturamento_total,
      to_date(d.ano::text || lpad(d.numero_semana::text, 2, '0'), 'IYYYIW') AS ini,
      to_date(d.ano::text || lpad(d.numero_semana::text, 2, '0'), 'IYYYIW') + 6 AS fim
    FROM gold.desempenho d
    WHERE d.granularidade = 'semanal' AND (p_ano IS NULL OR d.ano = p_ano)
  ),
  calc AS (
    SELECT r.bar_id, r.ano, r.numero_semana, r.faturamento_total,
      COALESCE(ca.valor, 0) AS conta_assinada, COALESCE(cc.comissao, 0) AS comissao
    FROM r
    LEFT JOIN LATERAL (
      SELECT SUM(p.valor) AS valor FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos p
      WHERE p.bar_id = r.bar_id AND p.meio = 'Conta Assinada' AND p.dt_gerencial::date BETWEEN r.ini AND r.fim
    ) ca ON true
    LEFT JOIN LATERAL public.get_comissao_couvert_periodo(r.bar_id, r.ini, r.fim) cc ON true
  )
  UPDATE gold.desempenho d
  SET conta_assinada_valor = calc.conta_assinada,
      conta_assinada_perc = CASE WHEN COALESCE(calc.faturamento_total,0) > 0
        THEN ROUND(calc.conta_assinada / calc.faturamento_total * 100, 2) ELSE 0 END,
      comissao = calc.comissao
  FROM calc
  WHERE d.granularidade='semanal' AND d.bar_id=calc.bar_id AND d.ano=calc.ano AND d.numero_semana=calc.numero_semana;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

-- Cron logo após o gold-desempenho (12:00 UTC):
-- SELECT cron.schedule('desempenho-conta-assinada-comissao','20 12 * * *',
--   $$ SELECT public.atualizar_conta_assinada_comissao_desempenho(EXTRACT(year FROM CURRENT_DATE)::int); $$);
