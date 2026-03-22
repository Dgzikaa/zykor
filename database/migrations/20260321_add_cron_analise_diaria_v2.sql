-- Migration: Cron jobs para analise diaria automatica v2
-- Roda as 9h BRT (12h UTC) para cada bar
-- Usa o agente com tool-use para analise completa

-- Remover crons antigos se existirem
SELECT cron.unschedule('analise-diaria-v2-bar3') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'analise-diaria-v2-bar3'
);
SELECT cron.unschedule('analise-diaria-v2-bar4') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'analise-diaria-v2-bar4'
);

-- Analise diaria automatica para Ordinario (bar_id=3)
-- Roda as 12:00 UTC = 09:00 BRT
SELECT cron.schedule(
  'analise-diaria-v2-bar3',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/agente-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"action":"analise-diaria-v2","bar_id":3}'::jsonb
  );
  $$
);

-- Analise diaria automatica para Deboche (bar_id=4)
-- Roda as 12:05 UTC = 09:05 BRT (5 min depois para nao sobrecarregar)
SELECT cron.schedule(
  'analise-diaria-v2-bar4',
  '5 12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/agente-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"action":"analise-diaria-v2","bar_id":4}'::jsonb
  );
  $$
);

-- Verificar se os crons foram criados
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname LIKE 'analise-diaria-v2%';