-- Setup Google Reviews Sync
-- Data: 27/02/2026
-- Descrição: Configura job pgcron para sincronizar reviews do Apify diariamente

-- 1. Deletar job antigo se existir
SELECT cron.unschedule('google-reviews-daily-sync');

-- 2. Criar novo job que roda às 9h (horário de Brasília = 12h UTC)
SELECT cron.schedule(
  'google-reviews-daily-sync',
  '0 12 * * *', -- 9h Brasília
  $$
  SELECT
    net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/google-reviews-apify-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'run_new_scrape', true
      )
    ) as request_id;
  $$
);

-- 3. Verificar job criado
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'google-reviews-daily-sync';
