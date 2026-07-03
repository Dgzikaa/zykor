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

-- 4. CONTAHUB CAIXA TURNO SYNC — "Saída de dinheiro do caixa" (sangria) por turno
-- Diário 09:30 BRT (12:30 UTC), após o vendasperiodo de ontem estar populado.
-- Sem data => ontem (BRT), ambos os bares. Idempotente por (bar_id, trn, chave).
SELECT cron.schedule(
  'contahub-caixa-turno-sync-diario',
  '30 12 * * *',
  $$
  SELECT net.http_post(
    url := get_supabase_url() || '/functions/v1/contahub-caixa-turno-sync',
    headers := jsonb_build_object('Authorization','Bearer '||get_service_role_key(),'Content-Type','application/json'),
    body := jsonb_build_object('jitter_min_ms', 2000, 'jitter_max_ms', 6000),
    timeout_milliseconds := 280000
  );
  $$
);
