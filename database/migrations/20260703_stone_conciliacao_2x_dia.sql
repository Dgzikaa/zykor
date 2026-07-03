-- Stone/Conciliação 2x/dia: a Stone só disponibiliza o arquivo-conciliação de um dia-calendário
-- DEPOIS que ele acaba ("Conciliation generation is only permitted in past dates"), e o arquivo
-- de D-1 costuma "assentar" só no meio da manhã seguinte. Como a Conferência usa dia operacional
-- (corte 6h), a madrugada de um dia mora no arquivo do dia-calendário SEGUINTE → dia operacional D
-- só fecha 100% em D+2. Rodar sync/parse/conciliação também no início da tarde faz os dias recentes
-- fecharem no mesmo dia (em vez de esperar o cron da manhã seguinte).
--
-- Horas em UTC (BRT = UTC-3): 10/16 = 07h/13h ; 11/17 = 08h/14h.
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'stone-sync-diario'),
  schedule => '0 10,16 * * *');    -- 07:00 e 13:00 BRT
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'stone-parse-diario'),
  schedule => '20 10,16 * * *');   -- 07:20 e 13:20 BRT
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'conciliacao-fiscal-diario'),
  schedule => '20 11,17 * * *');   -- 08:20 e 14:20 BRT
