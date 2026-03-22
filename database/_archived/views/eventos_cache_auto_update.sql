-- SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA DO CACHE - SGB_V3
-- =====================================================
-- Garante que eventos_cache sempre esteja atualizado
-- =====================================================

-- 1. TRIGGERS PARA AUTO-REFRESH EM TEMPO REAL
-- =====================================================

-- Trigger para atualizar cache quando dados ContaHub chegarem
CREATE OR REPLACE FUNCTION trigger_refresh_eventos_cache()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    affected_date DATE;
    cache_updated INTEGER;
BEGIN
    -- Determinar data afetada baseada na tabela
    IF TG_TABLE_NAME = 'contahub_pagamentos' THEN
        affected_date := NEW.dt_gerencial;
    ELSIF TG_TABLE_NAME = 'contahub_periodo' THEN
        affected_date := NEW.dt_gerencial;
    ELSIF TG_TABLE_NAME = 'contahub_analitico' THEN
        affected_date := NEW.trn_dtgerencial;
    ELSIF TG_TABLE_NAME = 'contahub_fatporhora' THEN
        affected_date := NEW.vd_dtgerencial;
    ELSIF TG_TABLE_NAME = 'nibo_agendamentos' THEN
        affected_date := NEW.data_competencia;
    ELSIF TG_TABLE_NAME = 'yuzer_fatporhora' THEN
        affected_date := NEW.data_evento;
    ELSE
        RETURN NEW; -- Tabela não monitorada
    END IF;
    
    -- Log da atualização
    RAISE NOTICE 'Atualizando cache para data % devido a mudança em %', affected_date, TG_TABLE_NAME;
    
    -- Refresh do cache apenas para a data específica
    SELECT refresh_eventos_cache(affected_date, affected_date, 3) INTO cache_updated;
    
    RAISE NOTICE 'Cache atualizado: % registros para %', cache_updated, affected_date;
    
    RETURN NEW;
END;
$$;

-- 2. APLICAR TRIGGERS NAS TABELAS PRINCIPAIS
-- =====================================================

-- ContaHub Pagamentos
DROP TRIGGER IF EXISTS trigger_contahub_pagamentos_cache ON contahub_pagamentos;
CREATE TRIGGER trigger_contahub_pagamentos_cache
    AFTER INSERT OR UPDATE ON contahub_pagamentos
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_eventos_cache();

-- ContaHub Período
DROP TRIGGER IF EXISTS trigger_contahub_periodo_cache ON contahub_periodo;
CREATE TRIGGER trigger_contahub_periodo_cache
    AFTER INSERT OR UPDATE ON contahub_periodo
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_eventos_cache();

-- ContaHub Analítico
DROP TRIGGER IF EXISTS trigger_contahub_analitico_cache ON contahub_analitico;
CREATE TRIGGER trigger_contahub_analitico_cache
    AFTER INSERT OR UPDATE ON contahub_analitico
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_eventos_cache();

-- ContaHub Fat Por Hora
DROP TRIGGER IF EXISTS trigger_contahub_fatporhora_cache ON contahub_fatporhora;
CREATE TRIGGER trigger_contahub_fatporhora_cache
    AFTER INSERT OR UPDATE ON contahub_fatporhora
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_eventos_cache();

-- NIBO Agendamentos
DROP TRIGGER IF EXISTS trigger_nibo_agendamentos_cache ON nibo_agendamentos;
CREATE TRIGGER trigger_nibo_agendamentos_cache
    AFTER INSERT OR UPDATE ON nibo_agendamentos
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_eventos_cache();

-- Yuzer Fat Por Hora
DROP TRIGGER IF EXISTS trigger_yuzer_fatporhora_cache ON yuzer_fatporhora;
CREATE TRIGGER trigger_yuzer_fatporhora_cache
    AFTER INSERT OR UPDATE ON yuzer_fatporhora
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_eventos_cache();

-- 3. PG_CRON PARA REFRESH COMPLETO DIÁRIO
-- =====================================================

-- Limpar jobs antigos primeiro (opcional - executar manualmente se necessário)
-- SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname LIKE 'eventos_cache%';

-- Job diário às 2h da manhã para garantir consistência completa
SELECT cron.schedule(
    'eventos_cache_refresh_diario',
    '0 2 * * *', -- Todo dia às 2h
    $$SELECT refresh_eventos_cache();$$
);

-- Job de backup - refresh do mês atual a cada 6 horas
SELECT cron.schedule(
    'eventos_cache_refresh_mes_atual',
    '0 */6 * * *', -- A cada 6 horas
    $$SELECT refresh_eventos_cache_mes(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER);$$
);

-- 4. FUNÇÃO PARA REFRESH RÁPIDO POR DATA ESPECÍFICA
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_eventos_cache_data(p_data DATE)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    total_rows INTEGER;
BEGIN
    -- Refresh apenas da data específica
    SELECT refresh_eventos_cache(p_data, p_data, 3) INTO total_rows;
    
    RETURN total_rows;
END;
$$;

-- 5. TRIGGER PARA NOVOS EVENTOS
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_novo_evento_cache()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    cache_updated INTEGER;
BEGIN
    -- Quando um novo evento é criado, criar entrada no cache
    IF TG_OP = 'INSERT' THEN
        RAISE NOTICE 'Novo evento criado: % para %', NEW.nome, NEW.data_evento;
        
        -- Refresh do cache para a data do novo evento
        SELECT refresh_eventos_cache_data(NEW.data_evento) INTO cache_updated;
        
        RAISE NOTICE 'Cache atualizado para novo evento: % registros', cache_updated;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger para eventos (assumindo que eventos é uma view - ajustar se necessário)
-- DROP TRIGGER IF EXISTS trigger_novos_eventos_cache ON eventos;
-- CREATE TRIGGER trigger_novos_eventos_cache
--     AFTER INSERT ON eventos
--     FOR EACH ROW EXECUTE FUNCTION trigger_novo_evento_cache();

-- 6. FUNÇÃO DE MONITORAMENTO
-- =====================================================
CREATE OR REPLACE FUNCTION check_eventos_cache_status()
RETURNS TABLE(
    tabela TEXT,
    ultima_atualizacao TIMESTAMP WITH TIME ZONE,
    registros_cache INTEGER,
    status TEXT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'eventos_cache'::TEXT as tabela,
        MAX(calculado_em) as ultima_atualizacao,
        COUNT(*)::INTEGER as registros_cache,
        CASE 
            WHEN MAX(calculado_em) > NOW() - INTERVAL '1 day' THEN 'ATUALIZADO'
            WHEN MAX(calculado_em) > NOW() - INTERVAL '3 days' THEN 'DESATUALIZADO'
            ELSE 'CRÍTICO'
        END as status
    FROM eventos_cache;
END;
$$;

-- 7. FUNÇÃO PARA FORÇAR REFRESH COMPLETO (EMERGÊNCIA)
-- =====================================================
CREATE OR REPLACE FUNCTION emergency_refresh_eventos_cache()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    total_updated INTEGER;
    result_text TEXT;
BEGIN
    start_time := clock_timestamp();
    
    -- Limpar cache completamente
    DELETE FROM eventos_cache;
    
    -- Repovoar com dados dos últimos 6 meses
    SELECT refresh_eventos_cache(
        (CURRENT_DATE - INTERVAL '6 months')::DATE,
        (CURRENT_DATE + INTERVAL '3 months')::DATE
    ) INTO total_updated;
    
    end_time := clock_timestamp();
    
    result_text := format(
        'Emergency refresh completo: %s registros atualizados em %s ms',
        total_updated,
        EXTRACT(milliseconds FROM end_time - start_time)
    );
    
    RAISE NOTICE '%', result_text;
    
    RETURN result_text;
END;
$$;

-- =====================================================
-- RESUMO DO SISTEMA DE AUTO-ATUALIZAÇÃO:
-- =====================================================
--
-- ✅ TRIGGERS EM TEMPO REAL:
-- • contahub_pagamentos → Auto-refresh imediato
-- • contahub_periodo → Auto-refresh imediato  
-- • contahub_analitico → Auto-refresh imediato
-- • contahub_fatporhora → Auto-refresh imediato
-- • nibo_agendamentos → Auto-refresh imediato
-- • yuzer_fatporhora → Auto-refresh imediato
--
-- ✅ PG_CRON AUTOMÁTICO:
-- • 2h da manhã: Refresh completo diário
-- • A cada 6h: Refresh do mês atual
--
-- ✅ MONITORAMENTO:
-- • check_eventos_cache_status() → Verificar saúde do cache
-- • emergency_refresh_eventos_cache() → Refresh de emergência
--
-- ✅ COMO FUNCIONA NA PRÁTICA:
-- 1. Edge Function sync do ContaHub roda → Dados inseridos nas tabelas
-- 2. Triggers detectam inserção → Cache atualizado automaticamente
-- 3. API do planejamento comercial → Dados sempre atualizados
-- 4. PG_CRON faz backup diário → Garantia de consistência
--
-- RESULTADO: ZERO INTERVENÇÃO MANUAL NECESSÁRIA! 🚀
-- =====================================================

-- Verificar status inicial
SELECT * FROM check_eventos_cache_status();
