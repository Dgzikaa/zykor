-- =====================================================
-- REORGANIZAR CRON JOBS PARA EVITAR RACE CONDITIONS
-- =====================================================
-- Data: 2026-04-04
-- Objetivo: 
--   1. Escalonar jobs pesados que rodavam simultaneamente às 11h
--   2. Remover cron jobs que chamam Edge Functions inexistentes
--   3. Reduzir frequência de jobs excessivos
--   4. Respeitar cadeia de dependências de dados
-- =====================================================

-- =====================================================
-- PARTE 1: REMOVER CRON JOBS QUE CHAMAM FUNÇÕES INEXISTENTES
-- =====================================================

-- Remover contahub-processor-diario-ordinario (chama Edge Function que não existe)
SELECT cron.unschedule('contahub-processor-diario-ordinario') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'contahub-processor-diario-ordinario'
);

-- Remover contahub-processor-diario-deboche (chama Edge Function que não existe)
SELECT cron.unschedule('contahub-processor-diario-deboche') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'contahub-processor-diario-deboche'
);

-- =====================================================
-- PARTE 2: REORGANIZAR CADEIA DE DADOS (EVITAR RACE CONDITIONS)
-- =====================================================
-- ANTES: 4 jobs pesados rodavam simultaneamente às 11h BRT (14h UTC):
--   - desempenho-auto-diario
--   - cmv-semanal-auto-ambos
--   - contahub-update-eventos-ambos
--   - eventos_cache_refresh_mes_atual
--
-- DEPOIS: Escalonar respeitando dependências:
--   10:00 BRT (13h UTC) → contahub-sync (busca dados do dia anterior)
--   10:30 BRT (13h30 UTC) → contahub-update-eventos-ambos (atualiza eventos_base)
--   11:00 BRT (14h UTC) → auto-recalculo-eventos-pos-contahub (recalcula eventos pendentes)
--   11:30 BRT (14h30 UTC) → desempenho-auto-diario (calcula desempenho semanal)
--   12:00 BRT (15h UTC) → cmv-semanal-auto-ambos (calcula CMV)
--   12:30 BRT (15h30 UTC) → eventos_cache_refresh_mes_atual (refresh cache)
-- =====================================================

-- 1. contahub-sync-7h-ambos: mover de 10h para 10h BRT (13h UTC)
-- (Já está no horário correto, apenas documentando)

-- 2. contahub-update-eventos-ambos: mover de 11h para 10h30 BRT (13h30 UTC)
DO $$
BEGIN
  UPDATE cron.job 
  SET schedule = '30 13 * * *'
  WHERE jobname = 'contahub-update-eventos-ambos';
END $$;

-- 3. auto-recalculo-eventos-pos-contahub: mover de 11h30 para 11h BRT (14h UTC)
DO $$
BEGIN
  UPDATE cron.job 
  SET schedule = '0 14 * * *'
  WHERE jobname = 'auto-recalculo-eventos-pos-contahub';
END $$;

-- 4. desempenho-auto-diario: mover de 11h para 11h30 BRT (14h30 UTC)
DO $$
BEGIN
  UPDATE cron.job 
  SET schedule = '30 14 * * *'
  WHERE jobname = 'desempenho-auto-diario';
END $$;

-- 5. cmv-semanal-auto-ambos: mover de 11h para 12h BRT (15h UTC)
DO $$
BEGIN
  UPDATE cron.job 
  SET schedule = '0 15 * * *'
  WHERE jobname = 'cmv-semanal-auto-ambos';
END $$;

-- 6. eventos_cache_refresh_mes_atual: mover de 11h,17h,23h para 12h30,17h,23h BRT (15h30,20h,02h UTC)
DO $$
BEGIN
  UPDATE cron.job 
  SET schedule = '30 15,0 20,0 2 * * *'
  WHERE jobname = 'eventos_cache_refresh_mes_atual';
END $$;

-- =====================================================
-- PARTE 3: REDUZIR FREQUÊNCIA DE JOBS EXCESSIVOS
-- =====================================================

-- processar_alertas_discord: reduzir de 30min para 2h
DO $$
BEGIN
  UPDATE cron.job 
  SET schedule = '0 */2 * * *'
  WHERE jobname = 'processar_alertas_discord';
END $$;

-- getin-sync-continuo: reduzir de 2h para 3x/dia (10h, 16h, 22h BRT = 13h, 19h, 01h UTC)
DO $$
BEGIN
  UPDATE cron.job 
  SET schedule = '0 13,19 1 * * *'
  WHERE jobname = 'getin-sync-continuo';
END $$;

-- =====================================================
-- VERIFICAR RESULTADO
-- =====================================================
SELECT 
  jobname, 
  schedule,
  CASE 
    WHEN jobname = 'contahub-sync-7h-ambos' THEN '10:00 BRT (13:00 UTC)'
    WHEN jobname = 'contahub-update-eventos-ambos' THEN '10:30 BRT (13:30 UTC)'
    WHEN jobname = 'auto-recalculo-eventos-pos-contahub' THEN '11:00 BRT (14:00 UTC)'
    WHEN jobname = 'desempenho-auto-diario' THEN '11:30 BRT (14:30 UTC)'
    WHEN jobname = 'cmv-semanal-auto-ambos' THEN '12:00 BRT (15:00 UTC)'
    WHEN jobname = 'eventos_cache_refresh_mes_atual' THEN '12:30, 17:00, 23:00 BRT'
    WHEN jobname = 'processar_alertas_discord' THEN 'A cada 2h'
    WHEN jobname = 'getin-sync-continuo' THEN '10:00, 16:00, 22:00 BRT'
    ELSE 'Não alterado'
  END as horario_brt
FROM cron.job 
WHERE jobname IN (
  'contahub-sync-7h-ambos',
  'contahub-update-eventos-ambos',
  'auto-recalculo-eventos-pos-contahub',
  'desempenho-auto-diario',
  'cmv-semanal-auto-ambos',
  'eventos_cache_refresh_mes_atual',
  'processar_alertas_discord',
  'getin-sync-continuo'
)
ORDER BY 
  CASE jobname
    WHEN 'contahub-sync-7h-ambos' THEN 1
    WHEN 'contahub-update-eventos-ambos' THEN 2
    WHEN 'auto-recalculo-eventos-pos-contahub' THEN 3
    WHEN 'desempenho-auto-diario' THEN 4
    WHEN 'cmv-semanal-auto-ambos' THEN 5
    WHEN 'eventos_cache_refresh_mes_atual' THEN 6
    WHEN 'processar_alertas_discord' THEN 7
    WHEN 'getin-sync-continuo' THEN 8
  END;

-- =====================================================
-- RESUMO DAS MUDANÇAS
-- =====================================================
-- ✅ REMOVIDOS (chamavam funções inexistentes):
--    - contahub-processor-diario-ordinario
--    - contahub-processor-diario-deboche
--
-- ✅ REORGANIZADOS (evitar race conditions às 11h):
--    - contahub-update-eventos-ambos: 11h → 10h30 BRT
--    - auto-recalculo-eventos-pos-contahub: 11h30 → 11h BRT
--    - desempenho-auto-diario: 11h → 11h30 BRT
--    - cmv-semanal-auto-ambos: 11h → 12h BRT
--    - eventos_cache_refresh_mes_atual: 11h → 12h30 BRT (mantém 17h e 23h)
--
-- ✅ FREQUÊNCIA REDUZIDA:
--    - processar_alertas_discord: 30min → 2h
--    - getin-sync-continuo: 2h → 3x/dia (10h, 16h, 22h)
-- =====================================================
