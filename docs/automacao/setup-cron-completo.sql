-- ========================================
-- AGENTE DE EXPLORAÇÃO DIÁRIA - SETUP
-- ========================================
-- Data: 27/02/2026
-- Execução: Todo dia às 6h da manhã (BRT)

-- 1. CRIAR TABELA DE RELATÓRIOS
CREATE TABLE IF NOT EXISTS relatorios_diarios (
  id BIGSERIAL PRIMARY KEY,
  bar_id INTEGER NOT NULL REFERENCES bars(id),
  data_referencia DATE NOT NULL,
  score_saude NUMERIC(5,2),
  problemas JSONB DEFAULT '[]'::jsonb,
  alertas JSONB DEFAULT '[]'::jsonb,
  faturamento NUMERIC(12,2),
  publico INTEGER,
  ticket_medio NUMERIC(10,2),
  tempo_execucao_ms INTEGER,
  executado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bar_id, data_referencia)
);

CREATE INDEX IF NOT EXISTS idx_relatorios_diarios_bar_data 
  ON relatorios_diarios(bar_id, data_referencia DESC);

ALTER TABLE relatorios_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver relatórios do seu bar"
  ON relatorios_diarios FOR SELECT TO authenticated
  USING (bar_id IN (SELECT bar_id FROM user_bars WHERE user_id = auth.uid()));

-- 2. CRIAR EXTENSÕES
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- 3. CRIAR FUNÇÃO
CREATE OR REPLACE FUNCTION executar_agente_diario()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url TEXT;
  v_response http_response;
BEGIN
  v_url := 'https://zykor.vercel.app/api/exploracao/agente-diario?secret=' || 
           current_setting('app.cron_secret', true);
  
  SELECT * INTO v_response FROM http_get(v_url);
  
  RAISE NOTICE 'Agente diário executado. Status: %', v_response.status;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Erro ao executar agente: %', SQLERRM;
END;
$$;

-- 4. REMOVER JOBS ANTIGOS (se existirem)
DO $$
BEGIN
  PERFORM cron.unschedule('agente-exploracao-diario');
  PERFORM cron.unschedule('relatorio-semanal');
  PERFORM cron.unschedule('exploracao-mensal');
EXCEPTION
  WHEN OTHERS THEN NULL;
END;
$$;

-- 5. CRIAR CRON JOBS
-- Job Diário: Todo dia às 6h BRT (9h UTC)
SELECT cron.schedule(
  'agente-exploracao-diario',
  '0 9 * * *',
  $$SELECT executar_agente_diario();$$
);

-- Job Semanal: Segunda-feira às 7h BRT (10h UTC)
SELECT cron.schedule(
  'relatorio-semanal',
  '0 10 * * 1',
  $$SELECT executar_agente_diario();$$
);

-- Job Mensal: Dia 1 às 6h BRT (9h UTC)
SELECT cron.schedule(
  'exploracao-mensal',
  '0 9 1 * *',
  $$SELECT executar_agente_diario();$$
);

-- 6. CONFIGURAR SECRET (EXECUTAR SEPARADAMENTE)
-- ALTER DATABASE postgres SET app.cron_secret = 'seu-secret-aqui';

-- 7. VERIFICAR JOBS CRIADOS
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname LIKE '%agente%' OR jobname LIKE '%relatorio%' OR jobname LIKE '%exploracao%'
ORDER BY jobid;
