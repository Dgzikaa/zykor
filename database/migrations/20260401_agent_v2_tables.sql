-- ====================================================
-- MIGRAÇÃO: Tabelas Agent V2 (Arquitetura Modular)
-- Data: 2026-04-01
-- ====================================================
-- 
-- Tabelas criadas:
--   1. insight_events          (eventos detectados pelo detector determinístico)
--   2. agent_insights_v2       (insights gerados pelo narrator LLM)
-- 
-- Todas com RLS habilitado + policies padrão do projeto.
-- ====================================================

-- ====================================================
-- 1. INSIGHT_EVENTS (Eventos Detectados)
-- ====================================================

CREATE TABLE IF NOT EXISTS public.insight_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bar_id INTEGER NOT NULL REFERENCES public.bares_config(bar_id),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('baixa', 'media', 'alta')),
    evidence_json JSONB NOT NULL DEFAULT '[]',
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insight_events_bar_data 
    ON public.insight_events(bar_id, data);
CREATE INDEX IF NOT EXISTS idx_insight_events_type 
    ON public.insight_events(event_type);
CREATE INDEX IF NOT EXISTS idx_insight_events_processed 
    ON public.insight_events(processed);

COMMENT ON TABLE public.insight_events IS 'Eventos detectados pelo detector determinístico do Agent V2. Ex: queda_ticket_medio, aumento_custo, etc.';
COMMENT ON COLUMN public.insight_events.event_type IS 'Tipo do evento detectado (ex: queda_ticket_medio, aumento_custo, etc)';
COMMENT ON COLUMN public.insight_events.severity IS 'Severidade do evento: baixa, media ou alta';
COMMENT ON COLUMN public.insight_events.evidence_json IS 'Evidências do evento em formato JSON (métricas, comparações, etc)';
COMMENT ON COLUMN public.insight_events.processed IS 'Indica se o evento já foi processado pelo narrator LLM';

-- ====================================================
-- 2. AGENT_INSIGHTS_V2 (Insights Gerados pelo LLM)
-- ====================================================

CREATE TABLE IF NOT EXISTS public.agent_insights_v2 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bar_id INTEGER NOT NULL REFERENCES public.bares_config(bar_id),
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    severidade TEXT NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta')),
    tipo TEXT NOT NULL CHECK (tipo IN ('problema', 'oportunidade')),
    causa_provavel TEXT,
    acoes_recomendadas JSONB DEFAULT '[]',
    eventos_relacionados UUID[] DEFAULT '{}',
    resumo_geral TEXT,
    source TEXT DEFAULT 'zykor_agent',
    visualizado BOOLEAN DEFAULT false,
    arquivado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_insights_v2_bar_data 
    ON public.agent_insights_v2(bar_id, data);
CREATE INDEX IF NOT EXISTS idx_agent_insights_v2_visualizado 
    ON public.agent_insights_v2(visualizado);
CREATE INDEX IF NOT EXISTS idx_agent_insights_v2_arquivado 
    ON public.agent_insights_v2(arquivado);
CREATE INDEX IF NOT EXISTS idx_agent_insights_v2_tipo 
    ON public.agent_insights_v2(tipo);
CREATE INDEX IF NOT EXISTS idx_agent_insights_v2_severidade 
    ON public.agent_insights_v2(severidade);

COMMENT ON TABLE public.agent_insights_v2 IS 'Insights gerados pelo narrator LLM do Agent V2. Versão modular da tabela agente_insights.';
COMMENT ON COLUMN public.agent_insights_v2.titulo IS 'Título do insight gerado pelo LLM';
COMMENT ON COLUMN public.agent_insights_v2.descricao IS 'Descrição detalhada do insight';
COMMENT ON COLUMN public.agent_insights_v2.severidade IS 'Severidade: baixa, media ou alta';
COMMENT ON COLUMN public.agent_insights_v2.tipo IS 'Tipo: problema ou oportunidade';
COMMENT ON COLUMN public.agent_insights_v2.causa_provavel IS 'Causa provável identificada pelo LLM';
COMMENT ON COLUMN public.agent_insights_v2.acoes_recomendadas IS 'Array JSON de ações recomendadas';
COMMENT ON COLUMN public.agent_insights_v2.eventos_relacionados IS 'Array de UUIDs referenciando insight_events';
COMMENT ON COLUMN public.agent_insights_v2.resumo_geral IS 'Resumo executivo do insight';
COMMENT ON COLUMN public.agent_insights_v2.visualizado IS 'Indica se o insight foi visualizado pelo usuário';
COMMENT ON COLUMN public.agent_insights_v2.arquivado IS 'Indica se o insight foi arquivado';

-- ====================================================
-- ROW LEVEL SECURITY
-- ====================================================

-- 1. INSIGHT_EVENTS
ALTER TABLE public.insight_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.insight_events;
CREATE POLICY "service_role_full_access" ON public.insight_events 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "insight_events_bar_access" ON public.insight_events;
CREATE POLICY "insight_events_bar_access" ON public.insight_events 
    FOR ALL TO authenticated 
    USING (bar_id IN (
        SELECT bar_id FROM public.user_bar_access WHERE user_id = auth.uid()
    ));

-- 2. AGENT_INSIGHTS_V2
ALTER TABLE public.agent_insights_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON public.agent_insights_v2;
CREATE POLICY "service_role_full_access" ON public.agent_insights_v2 
    FOR ALL TO service_role 
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "agent_insights_v2_bar_access" ON public.agent_insights_v2;
CREATE POLICY "agent_insights_v2_bar_access" ON public.agent_insights_v2 
    FOR ALL TO authenticated 
    USING (bar_id IN (
        SELECT bar_id FROM public.user_bar_access WHERE user_id = auth.uid()
    ));

-- ====================================================
-- FIM DA MIGRAÇÃO
-- ====================================================
