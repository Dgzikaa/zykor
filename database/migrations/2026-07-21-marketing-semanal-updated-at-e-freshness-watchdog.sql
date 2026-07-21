-- 2026-07-21 — Marketing semanal: updated_at confiável + watchdog de freshness
-- Contexto: o sync diário (/api/estrategico/desempenho/sync-marketing, cron 14h UTC) já
-- preenche [O] Orgânico (IG Feed+Reels, bar 3) e [M] Meta Ads (bares 3/4) em
-- meta.marketing_semanal, mas:
--   (a) o upsert NÃO carimbava updated_at (a tabela só tinha trg_audit), então updated_at
--       refletia apenas edições manuais na tela — inútil como sinal de execução do cron;
--   (b) o pipeline não tinha watchdog de freshness — falha silenciosa passava batido.

-- 1) Carimbar updated_at em qualquer UPDATE (cron upsert OU edição manual).
DROP TRIGGER IF EXISTS trg_set_updated_at ON meta.marketing_semanal;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON meta.marketing_semanal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_generic();

-- 2) Registrar no watchdog universal (system.data_freshness_config -> public.v_data_freshness
--    -> gold.v_pipeline_health_completo -> tela Saúde do Pipeline). Idempotente.
--    Cron reprocessa semana atual + anterior dos 2 bares => max(updated_at) avança todo dia;
--    SLA 36h absorve 1 dia perdido sem falso positivo.
INSERT INTO system.data_freshness_config
  (pipeline_name, categoria, schema_origem, tabela_origem, coluna_tempo, coluna_bar,
   bars_esperados, sla_horas_max, volume_diario_min, criticidade, canal_discord, descricao)
SELECT
  'marketing_semanal', 'marketing', 'meta', 'marketing_semanal', 'updated_at', 'bar_id',
  ARRAY[3,4], 36, 0, 'media', 'pipeline_saude',
  'Marketing semanal auto (IG orgânico bar 3 + Meta Ads bares 3/4) — sync diário 14h UTC'
WHERE NOT EXISTS (
  SELECT 1 FROM system.data_freshness_config WHERE pipeline_name = 'marketing_semanal'
);
