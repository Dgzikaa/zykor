-- ============================================================================
-- Stockout pipeline: fix race condition entre sync (bronze) e processar (silver)
-- 2026-04-28
--
-- Sintoma: silver_contahub_operacional_stockout_processado ficava vazia em
-- alguns dias mesmo com bronze populada. Sócio do Deboche reportou
-- "stockout não puxa categorias" — era silver vazia em datas especificas.
--
-- Causa raiz: 4 crons em sequência separados por 5min:
--   19:00 — contahub-stockout-sync Ord (puxa bronze)
--   19:05 — stockout-processar Ord (processa silver) <-- gap pequeno demais
--   19:10 — contahub-stockout-sync Deb
--   19:15 — stockout-processar Deb                    <-- mesmo problema
--
-- Cron pgcron retorna "succeeded" só porque o net.http_post foi enviado, NAO
-- significa que a edge function de sync já tinha terminado de gravar bronze.
-- Quando o sync demorava ou tinha erro silencioso, o processar rodava com
-- bronze ainda vazia → silver ficava vazia. Em pgcron logs tudo aparece OK.
--
-- Fix combinado (A+B):
--   A) Aumenta gap 5min → 30min (suspensórios contra timing)
--   B) Processar agora processa D-1 (ontem) em vez de D0 (hoje). Bronze de
--      ontem tem 24h de antiguidade — race condition impossível.
--
-- Resultado:
--   19:00 — sync Ord D0 (bronze)
--   19:10 — sync Deb D0 (bronze)
--   19:30 — processar Ord D-1 (silver)        [gap 30min, data anterior]
--   19:45 — processar Deb D-1 (silver, ter-dom)
--
-- Aplicado: 2026-04-28 via cron.alter_job (pg_cron). Aplicar este script
-- novamente em ambiente novo (preview/staging) recria o estado.
-- ============================================================================

-- Ord (bar_id=3): processa todos os dias D-1
SELECT cron.alter_job(
  job_id := 402,
  schedule := '30 22 * * *',
  command := $cmd$
    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/stockout-processar',
      headers := jsonb_build_object('Authorization', 'Bearer ' || get_service_role_key(), 'Content-Type', 'application/json'),
      body := jsonb_build_object('bar_id', 3, 'data_date', (CURRENT_DATE - INTERVAL '1 day')::date::text),
      timeout_milliseconds := 60000
    )
  $cmd$
);

-- Deb (bar_id=4): processa D-1 todos exceto segunda (Deboche fechado, sem
-- bronze pra processar de domingo).
SELECT cron.alter_job(
  job_id := 403,
  schedule := '45 22 * * 0,2,3,4,5,6',
  command := $cmd$
    SELECT net.http_post(
      url := get_supabase_url() || '/functions/v1/stockout-processar',
      headers := jsonb_build_object('Authorization', 'Bearer ' || get_service_role_key(), 'Content-Type', 'application/json'),
      body := jsonb_build_object('bar_id', 4, 'data_date', (CURRENT_DATE - INTERVAL '1 day')::date::text),
      timeout_milliseconds := 60000
    )
  $cmd$
);
