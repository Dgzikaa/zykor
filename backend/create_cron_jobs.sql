-- ============================================
-- CRON JOBS - Zykor System
-- ============================================

-- 1. CONTA AZUL SYNC - A cada 2 horas
-- Sincroniza lançamentos financeiros do Conta Azul
SELECT cron.schedule(
  'contaazul-sync-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contaazul-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'bar_id', 3,
      'sync_mode', 'daily_incremental'
    )
  );
  $$
);

-- 2. CONTA AZUL SYNC DEBOCHE - A cada 2 horas (5 minutos depois)
SELECT cron.schedule(
  'contaazul-sync-2h-deboche',
  '5 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contaazul-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'bar_id', 4,
      'sync_mode', 'daily_incremental'
    )
  );
  $$
);

-- 3. CMV SEMANAL AUTO - Todo dia às 2h da manhã
-- Atualiza CMV com dados do Conta Azul e ContaHub
SELECT cron.schedule(
  'cmv-semanal-auto-diario',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/cmv-semanal-auto',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'todas_semanas', true
    )
  );
  $$
);

-- Verificar cron jobs criados
SELECT jobname, schedule, command FROM cron.job 
WHERE jobname IN ('contaazul-sync-2h', 'contaazul-sync-2h-deboche', 'cmv-semanal-auto-diario');
