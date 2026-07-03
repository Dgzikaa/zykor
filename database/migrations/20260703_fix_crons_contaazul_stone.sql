-- Fix de 2 crons que o smoke-check de infra pegou (03/07/26). Aplicado via cron.alter_job.
--
-- #2 contaazul-full-ano-2x-dia (jobid 529): falhava em TODA execução (timeout aos 120s).
--   Causa: o `SET statement_timeout TO '450s'` está no CORPO da função, mas isso NÃO
--   re-arma o timer do statement EXTERNO (`SELECT funcao()`), que roda com o timeout da
--   sessão do pg_cron (~120s). Fix: `SET statement_timeout` no COMANDO do cron (antes do
--   SELECT) — mesmo truque do contaazul-pessoas-diario (que roda ~160-190s ok).
select cron.alter_job(529, command => $cmd$ SET statement_timeout = '900000'; SELECT public.sync_contaazul_alteracao_full_ano(); $cmd$);

-- #1 stone-parse-diario (566) x stone-pix-backfill-drainer (575): deadlock transitório
--   quando o parse do diário e o do drainer (a cada 10min) rodavam juntos. Fix: advisory
--   lock compartilhado ('stone_parse') no início dos dois → serializam, sem deadlock.
select cron.alter_job(566, command => $cmd$ SELECT pg_advisory_xact_lock(hashtext('stone_parse')); SELECT silver.parse_stone_pendentes(false); $cmd$);

select cron.alter_job(575, command => $cmd$
  SELECT pg_advisory_xact_lock(hashtext('stone_parse'));
  SELECT silver.parse_stone_pix_pendentes();
  SELECT silver.sync_pix_to_stone_transacoes();
  WITH und AS (
    SELECT DISTINCT bar_id, reference_date FROM bronze.bronze_stone_pix
    WHERE csv_raw IS NULL AND reference_date >= (now()::date - 92)
    ORDER BY reference_date DESC LIMIT 20
  )
  SELECT net.http_post(url := 'https://zykor.com.br/api/stone/conciliacao/pix-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||public.get_service_role_key()),
    body := jsonb_build_object('bar_id', bar_id, 'reference_date', reference_date::text),
    timeout_milliseconds := 50000) FROM und;
$cmd$);
