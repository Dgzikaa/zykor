-- Corrigir cron do ContaHub para sincronizar AMBOS os bares
-- Problema: estava hardcoded apenas para bar_id=3

-- 1. Remover job antigo
SELECT cron.unschedule('contahub-daily-sync');

-- 2. Criar função corrigida que sincroniza AMBOS os bares
CREATE OR REPLACE FUNCTION sync_contahub_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    data_ontem DATE;
    resultado jsonb;
    bar_atual INTEGER;
BEGIN
    data_ontem := CURRENT_DATE - INTERVAL '1 day';
    
    -- Loop para cada bar ativo
    FOR bar_atual IN SELECT unnest(ARRAY[3, 4]) LOOP
        BEGIN
            RAISE NOTICE 'Sincronizando ContaHub para bar_id=%', bar_atual;
            
            -- Chamar API de sincronização
            SELECT content::jsonb INTO resultado
            FROM http((
                'GET',
                current_setting('app.supabase_url') || '/api/contahub/sync-diario?bar_id=' || bar_atual || '&date=' || data_ontem::text,
                ARRAY[
                    http_header('Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'))
                ],
                NULL,
                NULL
            ));
            
            RAISE NOTICE 'Bar % sincronizado: %', bar_atual, resultado->>'message';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro na sincronização ContaHub para bar %: %', bar_atual, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- 3. Reagendar com função corrigida
SELECT cron.schedule(
    'contahub-daily-sync',
    '0 7 * * *',  -- Todo dia às 07:00 UTC (04:00 BRT)
    'SELECT sync_contahub_daily();'
);

-- 4. Verificar
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'contahub-daily-sync';
