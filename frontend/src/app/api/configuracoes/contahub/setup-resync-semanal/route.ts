import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cronJobSQL = `-- ============================================================================
-- CRONJOB: RE-SINCRONIZAÇÃO SEMANAL CONTAHUB
-- ============================================================================
-- 
-- OBJETIVO: Re-sincronizar dados da semana anterior toda segunda-feira
-- 
-- PROBLEMA RESOLVIDO:
--   - Cancelamentos/estornos do dia 28.03 podem ser lançados apenas no dia 30.03
--   - Sincronização diária (D+1) não captura esses lançamentos tardios
--   - Dados ficam desatualizados permanentemente
-- 
-- SOLUÇÃO:
--   - Toda segunda-feira às 06:00 BRT (09:00 UTC)
--   - Re-sincroniza os últimos 7 dias (semana anterior)
--   - Captura cancelamentos, estornos e ajustes tardios
-- 
-- EXEMPLO:
--   Segunda 30.03.2026 → Re-sincroniza 23.03 a 29.03
-- 
-- ============================================================================

-- 1. Remover job antigo (se existir)
SELECT cron.unschedule('contahub-resync-semanal-ordinario');
SELECT cron.unschedule('contahub-resync-semanal-deboche');
SELECT cron.unschedule('contahub-resync-semanal');

-- 2. Criar job SEMANAL - Toda segunda-feira às 06:00 Brasília (09:00 UTC)
-- Re-sincroniza os últimos 7 dias para o Ordinário Bar (bar_id=3)
SELECT cron.schedule(
  'contahub-resync-semanal-ordinario',
  '0 9 * * 1', -- Toda segunda-feira às 09:00 UTC (06:00 BRT)
  $$
  SELECT
    net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-resync-semanal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'bar_id', 3,
        'dias_anteriores', 7
      )
    ) as request_id;
  $$
);

-- 3. Criar job SEMANAL para o Deboche Bar (bar_id=4)
-- Executa 15 minutos depois do Ordinário para não sobrecarregar
SELECT cron.schedule(
  'contahub-resync-semanal-deboche',
  '15 9 * * 1', -- Toda segunda-feira às 09:15 UTC (06:15 BRT)
  $$
  SELECT
    net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-resync-semanal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'bar_id', 4,
        'dias_anteriores', 7
      )
    ) as request_id;
  $$
);

-- 4. Verificar se foram criados
SELECT 
  jobname,
  schedule,
  active,
  last_run,
  next_run,
  CASE 
    WHEN jobname = 'contahub-resync-semanal-ordinario' THEN 'Segundas 09:00 UTC (06:00 BRT) - Ordinário'
    WHEN jobname = 'contahub-resync-semanal-deboche' THEN 'Segundas 09:15 UTC (06:15 BRT) - Deboche'
  END as descricao
FROM cron.job 
WHERE jobname LIKE 'contahub-resync-semanal%'
ORDER BY jobname;

-- ============================================================================
-- NOTAS:
-- ============================================================================
-- 
-- 1. HORÁRIO: Segunda-feira 06:00 BRT é ideal porque:
--    - Captura lançamentos tardios da sexta, sábado e domingo
--    - Não interfere com sync diário (07:00 BRT)
--    - Permite análises precisas para reunião semanal
-- 
-- 2. DIAS_ANTERIORES: 7 dias é suficiente porque:
--    - Lançamentos tardios geralmente ocorrem em 2-3 dias
--    - 7 dias garante cobertura completa da semana operacional
--    - Não sobrecarrega o sistema
-- 
-- 3. PROCESSAMENTO: Os dados são salvos em contahub_raw_data com processed=false
--    - pg_cron automático processa os dados (job separado a cada 30min)
--    - Usa UPSERT para atualizar registros existentes
-- 
-- 4. EXECUÇÃO MANUAL (para testar):
--    SELECT net.http_post(
--      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-resync-semanal',
--      headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
--      body := '{"bar_id": 3, "dias_anteriores": 7}'::jsonb
--    );
-- 
-- ============================================================================`;

    const summary = {
      method: 'manual_sql_execution',
      sql_ready: true,
      configuration: {
        job_names: [
          'contahub-resync-semanal-ordinario',
          'contahub-resync-semanal-deboche'
        ],
        schedule: '0 9 * * 1 (Segundas 06:00 BRT)',
        description: 'Re-sincroniza últimos 7 dias toda segunda-feira',
        target: 'Edge Function contahub-resync-semanal',
        parameters: { 
          bar_id: '3 (Ordinário) e 4 (Deboche)',
          dias_anteriores: 7
        }
      },
      sql_to_execute: cronJobSQL
    };

    return NextResponse.json({
      success: true,
      message: 'SQL para configuração do cronjob semanal está pronto',
      summary,
      instructions: [
        '1. Copie o SQL fornecido abaixo',
        '2. Acesse o Supabase Dashboard → SQL Editor',
        '3. Cole e execute o SQL',
        '4. Verifique se os jobs foram criados na última query'
      ]
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro ao preparar configuração:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const verificationSQL = `-- VERIFICAR STATUS DO CRONJOB RE-SYNC SEMANAL
-- Execute este SQL no Supabase SQL Editor:

-- 1. Verificar jobs de re-sync semanal
SELECT 
  jobname,
  schedule,
  active,
  last_run,
  next_run,
  CASE 
    WHEN EXTRACT(DOW FROM NOW()) = 1 AND EXTRACT(HOUR FROM NOW()) < 9 THEN 'Hoje às 09:00 UTC (06:00 BRT)'
    WHEN EXTRACT(DOW FROM NOW()) < 1 THEN 'Segunda às 09:00 UTC (06:00 BRT)'
    ELSE 'Próxima segunda às 09:00 UTC (06:00 BRT)'
  END as proxima_execucao_descricao
FROM cron.job 
WHERE jobname LIKE 'contahub-resync-semanal%'
ORDER BY jobname;

-- 2. Verificar últimas execuções
SELECT 
  runid,
  job_pid,
  jobname,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details 
WHERE jobname LIKE 'contahub-resync-semanal%'
ORDER BY start_time DESC 
LIMIT 10;

-- 3. Verificar dados re-sincronizados recentemente
SELECT 
  data_date,
  data_type,
  processed,
  record_count,
  created_at,
  updated_at
FROM contahub_raw_data
WHERE bar_id = 3
  AND updated_at > NOW() - INTERVAL '7 days'
  AND updated_at != created_at -- Apenas registros que foram atualizados
ORDER BY data_date DESC, data_type;`;

    return NextResponse.json({
      success: true,
      message: 'SQL para verificação do cronjob semanal está pronto',
      sql_to_execute: verificationSQL,
      instructions: 'Execute o SQL fornecido no Supabase SQL Editor para verificar o status',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro ao preparar verificação:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
