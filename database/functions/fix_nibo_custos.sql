-- CORREÇÕES PARA DEBOCHE BAR
-- ============================
-- 1. Adiciona filtro bar_id na query NIBO
-- 2. Usa categorias corretas por bar:
--    - Ordinário: 'Atrações Programação' + 'Produção Eventos'
--    - Deboche: 'Atrações/Eventos' (sem Produção separada)
-- 3. Mapeamento dinâmico de locais já aplicado anteriormente

-- APLICAR NO SUPABASE DASHBOARD SQL EDITOR:

-- Seção 6 da função (linha ~150-160):
-- SUBSTITUIR:
/*
SELECT 
    SUM(CASE WHEN categoria_nome = 'Atrações Programação' THEN valor ELSE 0 END) as custo_artistico,
    SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN valor ELSE 0 END) as custo_producao
INTO nibo_custos
FROM nibo_agendamentos
WHERE data_competencia = evento_record.data_evento;
*/

-- POR:
IF evento_record.bar_id = 3 THEN
    -- Ordinário: Atrações Programação + Produção Eventos
    SELECT 
        SUM(CASE WHEN categoria_nome = 'Atrações Programação' THEN valor ELSE 0 END) as custo_artistico,
        SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN valor ELSE 0 END) as custo_producao
    INTO nibo_custos
    FROM nibo_agendamentos
    WHERE data_competencia = evento_record.data_evento
    AND bar_id = evento_record.bar_id;
ELSIF evento_record.bar_id = 4 THEN
    -- Deboche: Atrações/Eventos (não tem Produção separada)
    SELECT 
        SUM(CASE WHEN categoria_nome = 'Atrações/Eventos' THEN valor ELSE 0 END) as custo_artistico,
        0 as custo_producao
    INTO nibo_custos
    FROM nibo_agendamentos
    WHERE data_competencia = evento_record.data_evento
    AND bar_id = evento_record.bar_id;
ELSE
    -- Default: mesmas regras do Ordinário
    SELECT 
        SUM(CASE WHEN categoria_nome = 'Atrações Programação' THEN valor ELSE 0 END) as custo_artistico,
        SUM(CASE WHEN categoria_nome = 'Produção Eventos' THEN valor ELSE 0 END) as custo_producao
    INTO nibo_custos
    FROM nibo_agendamentos
    WHERE data_competencia = evento_record.data_evento
    AND bar_id = evento_record.bar_id;
END IF;
