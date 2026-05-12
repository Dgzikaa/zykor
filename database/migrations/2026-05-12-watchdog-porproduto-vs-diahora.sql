-- Watchdog: detecta divergencia entre porproduto (analitico) e vendasdiahora.
-- Motivacao: bug LOCAIS_CONTAHUB hardcoded (09/05/2026, R$ 15k faltantes) +
-- triplicacao por sync concorrente (05/05/2026 chegou a ter 3x linhas no porproduto).
-- Roda 3x/dia BRT (8h, 14h, 20h = 11h, 17h, 23h UTC).
-- Alerta Discord via enviar_alerta_discord_sistema_dedup se diff > R$ 100 em qualquer dia dos ultimos 14.

CREATE OR REPLACE FUNCTION system.verificar_porproduto_vs_diahora()
RETURNS TABLE(bar_id int, dia date, porproduto numeric, diahora numeric, diff numeric)
LANGUAGE sql
SET search_path TO 'public', 'bronze', 'system', 'pg_catalog'
AS $body$
  WITH p AS (
    SELECT bar_id, trn_dtgerencial AS dia, sum(valorfinal) AS v
    FROM bronze.bronze_contahub_avendas_porproduto_analitico
    WHERE trn_dtgerencial >= CURRENT_DATE - INTERVAL '14 days'
      AND tipo IN ('venda integral','com desconto')
    GROUP BY 1,2
  ), d AS (
    SELECT bar_id, vd_dtgerencial AS dia, sum(valor) AS v
    FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico
    WHERE vd_dtgerencial >= CURRENT_DATE - INTERVAL '14 days'
    GROUP BY 1,2
  )
  SELECT p.bar_id, p.dia, p.v, d.v, (p.v - d.v) AS diff
  FROM p JOIN d USING (bar_id, dia)
  WHERE abs(p.v - d.v) > 100
  ORDER BY abs(p.v - d.v) DESC;
$body$;

CREATE OR REPLACE FUNCTION system.alertar_porproduto_vs_diahora_discord()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'bronze', 'system', 'pg_temp'
AS $body$
DECLARE
  v_msg text := '';
  v_count int := 0;
  v_dedup_key text;
  rec RECORD;
BEGIN
  FOR rec IN SELECT * FROM system.verificar_porproduto_vs_diahora() LOOP
    v_count := v_count + 1;
    v_msg := v_msg || format(E'- Bar %s - %s: porproduto R$ %s vs diahora R$ %s (diff R$ %s)\n',
      rec.bar_id, to_char(rec.dia, 'DD/MM'),
      to_char(rec.porproduto, 'FM999G999D00'),
      to_char(rec.diahora, 'FM999G999D00'),
      to_char(rec.diff, 'FM999G999D00'));
  END LOOP;

  IF v_count = 0 THEN RETURN 'OK_SEM_ALERTA'; END IF;

  v_dedup_key := 'porproduto_vs_diahora_' || to_char(CURRENT_DATE, 'YYYY_MM_DD');

  RETURN public.enviar_alerta_discord_sistema_dedup(
    NULL,
    'aviso',
    'contahub_bronze',
    format('Divergencia ContaHub porproduto vs diahora - %s dia(s)', v_count),
    'Ultimos 14 dias com diff > R$ 100 entre bronze_contahub_avendas_porproduto_analitico e bronze_contahub_avendas_vendasdiahoraanalitico:' || E'\n\n' || v_msg ||
    E'\nCausas conhecidas: bug LOCAIS_CONTAHUB (faltando local hardcoded) ou triplicacao por sync concorrente.',
    16776960,
    v_dedup_key
  );
END;
$body$;

SELECT cron.schedule(
  'porproduto-vs-diahora-alerta',
  '0 11,17,23 * * *',
  'SELECT system.alertar_porproduto_vs_diahora_discord();'
);
