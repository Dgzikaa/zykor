import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Gerando SQL para configuração do pg_cron - Desempenho Automático...');

    const cronJobSQL = `-- CONFIGURAR PG_CRON PARA DESEMPENHO AUTOMÁTICO
-- Execute este SQL no Supabase SQL Editor:

-- 1. Remover jobs antigos (se existirem)
SELECT cron.unschedule('desempenho-auto-diario');
SELECT cron.unschedule('desempenho-auto-segunda');
SELECT cron.unschedule('recalcular-desempenho-daily');
SELECT cron.unschedule('recalcular-desempenho-weekly');

-- 2. Criar job DIÁRIO - Todo dia às 08:00 Brasília (11:00 UTC)
-- Atualiza os dados do dia anterior
SELECT cron.schedule(
  'desempenho-auto-diario',
  '0 11 * * *',
  $$
  SELECT
    net.http_post(
      url := '${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recalcular-desempenho-auto',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- 3. Criar job SEMANAL - Toda segunda-feira às 09:00 Brasília (12:00 UTC)
-- Recalcula a semana completa anterior
SELECT cron.schedule(
  'desempenho-auto-segunda',
  '0 12 * * 1',
  $$
  SELECT
    net.http_post(
      url := '${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recalcular-desempenho-auto',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}"}'::jsonb,
      body := '{}'::jsonb
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
    WHEN jobname = 'desempenho-auto-diario' THEN 'Diário às 11:00 UTC (08:00 Brasília)'
    WHEN jobname = 'desempenho-auto-segunda' THEN 'Segundas às 12:00 UTC (09:00 Brasília)'
  END as descricao
FROM cron.job 
WHERE jobname IN ('desempenho-auto-diario', 'desempenho-auto-segunda')
ORDER BY jobname;

-- 5. (OPCIONAL) Executar manualmente agora para testar
-- Descomente a linha abaixo se quiser executar imediatamente:
-- SELECT net.http_post(url := '${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/recalcular-desempenho-auto', headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}"}'::jsonb, body := '{}'::jsonb);
`;

    const summary = {
      method: 'manual_sql_execution',
      sql_ready: true,
      jobs: [
        {
          job_name: 'desempenho-auto-diario',
          schedule: '0 11 * * *',
          description: 'Executa diariamente às 11:00 UTC (08:00 Brasília)',
          purpose: 'Atualiza faturamento, clientes e métricas do dia anterior'
        },
        {
          job_name: 'desempenho-auto-segunda',
          schedule: '0 12 * * 1',
          description: 'Executa toda segunda-feira às 12:00 UTC (09:00 Brasília)',
          purpose: 'Recalcula a semana completa anterior (consolidação semanal)'
        }
      ],
      target: 'Edge Function recalcular-desempenho-auto',
      what_it_does: [
        'Busca últimas 4 semanas (últimos 30 dias)',
        'Calcula faturamento total (ContaHub + Yuzer + Sympla)',
        'Calcula clientes atendidos e ticket médio',
        'Calcula % stockout de drinks e comidas',
        'Atualiza tabela desempenho_semanal'
      ],
      sql_to_execute: cronJobSQL
    };

    console.log('📊 SQL preparado para execução:', summary);

    return NextResponse.json({
      success: true,
      message: 'SQL para configuração do pg_cron está pronto',
      summary,
      instructions: [
        '1. Copie o SQL fornecido',
        '2. Acesse Supabase Dashboard → SQL Editor',
        '3. Cole e execute o SQL',
        '4. Verifique se os jobs foram criados com sucesso'
      ]
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro ao gerar SQL pg_cron:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Gerando SQL para verificação do pg_cron - Desempenho...');

    const verificationSQL = `-- VERIFICAR STATUS DO PG_CRON DESEMPENHO
-- Execute este SQL no Supabase SQL Editor:

-- 1. Verificar jobs do Desempenho
SELECT 
  jobname,
  schedule,
  active,
  last_run,
  next_run,
  CASE 
    WHEN jobname = 'desempenho-auto-diario' THEN 
      CASE 
        WHEN EXTRACT(HOUR FROM NOW()) < 11 THEN 'Hoje às 11:00 UTC (08:00 Brasília)'
        ELSE 'Amanhã às 11:00 UTC (08:00 Brasília)'
      END
    WHEN jobname = 'desempenho-auto-segunda' THEN 
      CASE 
        WHEN EXTRACT(DOW FROM NOW()) = 1 AND EXTRACT(HOUR FROM NOW()) < 12 THEN 'Hoje às 12:00 UTC (09:00 Brasília)'
        WHEN EXTRACT(DOW FROM NOW()) < 1 THEN 'Segunda às 12:00 UTC (09:00 Brasília)'
        ELSE 'Próxima segunda às 12:00 UTC (09:00 Brasília)'
      END
  END as proxima_execucao_descricao
FROM cron.job 
WHERE jobname IN ('desempenho-auto-diario', 'desempenho-auto-segunda')
ORDER BY jobname;

-- 2. Verificar últimas execuções
SELECT 
  runid,
  job_pid,
  database,
  username,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duracao_segundos
FROM cron.job_run_details 
WHERE command LIKE '%recalcular-desempenho-auto%'
ORDER BY start_time DESC 
LIMIT 10;

-- 3. Verificar dados recentes na tabela desempenho_semanal
SELECT 
  numero_semana,
  ano,
  data_inicio,
  data_fim,
  faturamento_total,
  clientes_atendidos,
  ticket_medio,
  updated_at
FROM desempenho_semanal
WHERE updated_at >= NOW() - INTERVAL '7 days'
ORDER BY ano DESC, numero_semana DESC
LIMIT 5;

-- 4. Listar todos os jobs ativos do sistema
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
      instructions: [
        'Execute o SQL fornecido no Supabase SQL Editor',
        'Verifique se os jobs estão ativos',
        'Confira as últimas execuções e seus resultados',
        'Valide se os dados estão sendo atualizados'
      ],
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

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ Gerando SQL para remover jobs do pg_cron - Desempenho...');

    const deleteSQL = `-- REMOVER JOBS DO PG_CRON DESEMPENHO
-- Execute este SQL no Supabase SQL Editor:

-- Remover jobs
SELECT cron.unschedule('desempenho-auto-diario');
SELECT cron.unschedule('desempenho-auto-segunda');

-- Verificar se foram removidos
SELECT 
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname IN ('desempenho-auto-diario', 'desempenho-auto-segunda');

-- Se não retornar nenhuma linha, os jobs foram removidos com sucesso`;

    return NextResponse.json({
      success: true,
      message: 'SQL para remoção dos jobs está pronto',
      sql_to_execute: deleteSQL,
      instructions: 'Execute o SQL fornecido no Supabase SQL Editor para remover os jobs'
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Erro ao gerar SQL de remoção:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
