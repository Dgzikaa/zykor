-- =====================================================================
-- Cron do RH: Tempo de Casa junto com a Pesquisa da Felicidade
-- =====================================================================
-- As duas actions leem a MESMA planilha ("Indicadores - RH" de cada bar),
-- então rodam no mesmo job — não faz sentido baixar o arquivo duas vezes em
-- horários diferentes.
--
-- timeout subiu de 180s para 300s: agora são duas abas por bar (semanal +
-- mensal + marca empregadora, e depois o Tempo de Casa), com download do xlsx
-- em cada action.
--
-- O `timeout_milliseconds` vai no net.http_post, NÃO como statement_timeout do
-- comando — ver feedback_cron_statement_timeout_no_comando.
-- =====================================================================

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'gsheets-sync-felicidade'),
  command := $cmd$
  select net.http_post(url := get_supabase_url() || '/functions/v1/google-sheets-sync',
    headers := jsonb_build_object('Authorization','Bearer '||get_service_role_key(),'Content-Type','application/json'),
    body := jsonb_build_object('actions', jsonb_build_array('pesquisa-felicidade','tempo-de-casa')), timeout_milliseconds := 300000)
  $cmd$
);
