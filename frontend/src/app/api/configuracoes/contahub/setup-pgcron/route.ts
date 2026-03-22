import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 1. Tentar executar diretamente usando MCP Supabase
    // Como não há RPC personalizada, vamos retornar as instruções SQL
    
    const cronJobSQL = `-- CONFIGURAR PG_CRON PARA CONTAHUB
-- Execute este SQL no Supabase SQL Editor:

-- 1. Remover jobs antigos (se existirem)
SELECT cron.unschedule('contahub-sync-daily-07h');
SELECT cron.unschedule('contahub-sync-automatico');
SELECT cron.unschedule('contahub-daily');

-- 2. Criar novo job - Diário às 07:00 Brasília (10:00 UTC)
SELECT cron.schedule(
  'contahub-sync-daily-07h',
  '0 10 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}"}'::jsonb,
      body := json_build_object(
        'bar_id', 3,
        'data_date', CURRENT_DATE::text
      )::text
    ) as request_id;
  $$
);

-- 3. Verificar se foi criado
SELECT 
  jobname,
  schedule,
  active,
  last_run,
  next_run
FROM cron.job 
WHERE jobname = 'contahub-sync-daily-07h';`;

    const summary = {
      method: 'manual_sql_execution',
      sql_ready: true,
      configuration: {
        job_name: 'contahub-sync-daily-07h',
        schedule: '0 10 * * *',
        description: 'Executa diariamente às 10:00 UTC (07:00 Brasília)',
        target: 'Edge Function contahub-sync-automatico',
        parameters: { bar_id: 3, data_date: 'CURRENT_DATE' }
      },
      sql_to_execute: cronJobSQL
    };

    return NextResponse.json({
      success: true,
      message: 'SQL para configuração do pg_cron está pronto',
      summary,
      instructions: 'Execute o SQL fornecido no Supabase SQL Editor'
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro geral ao configurar pg_cron:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Como não temos RPC personalizada, retornar instruções
    const verificationSQL = `-- VERIFICAR STATUS DO PG_CRON CONTAHUB
-- Execute este SQL no Supabase SQL Editor:

-- 1. Verificar jobs do ContaHub
SELECT 
  jobname,
  schedule,
  active,
  last_run,
  next_run,
  CASE 
    WHEN EXTRACT(HOUR FROM NOW()) < 10 THEN 'Hoje às 10:00 UTC (07:00 Brasília)'
    ELSE 'Amanhã às 10:00 UTC (07:00 Brasília)'
  END as proxima_execucao_descricao
FROM cron.job 
WHERE jobname LIKE '%contahub%'
ORDER BY jobname;

-- 2. Verificar últimas execuções
SELECT 
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE command LIKE '%contahub%'
ORDER BY start_time DESC 
LIMIT 5;

-- 3. Listar todos os jobs ativos
SELECT 
  jobname,
  schedule,
  active,
  last_run,
  next_run
FROM cron.job 
WHERE active = true
ORDER BY jobname;`;

    return NextResponse.json({
      success: true,
      message: 'SQL para verificação do pg_cron está pronto',
      sql_to_execute: verificationSQL,
      instructions: 'Execute o SQL fornecido no Supabase SQL Editor para verificar o status',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro ao preparar verificação pg_cron:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
