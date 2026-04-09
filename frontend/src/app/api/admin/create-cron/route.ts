import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * POST /api/admin/create-cron
 * Cria um cron job no Supabase para rodar cmv-semanal-auto diariamente
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // 1. Verificar se o cron job já existe
    const { data: existingJobs, error: checkError } = await supabase
      .rpc('cron.job', {});
    
    console.log('Verificando cron jobs existentes...');
    
    // 2. Criar o cron job usando SQL direto
    const cronSQL = `
      SELECT cron.schedule(
        'cmv-semanal-auto-diario',
        '0 2 * * *',
        $$
        SELECT net.http_post(
          url := 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/cmv-semanal-auto',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
          ),
          body := jsonb_build_object(
            'todas_semanas', true
          )
        );
        $$
      );
    `;
    
    // Executar via Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseKey) {
      return NextResponse.json({ 
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY não configurada'
      }, { status: 500 });
    }
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({ 
        sql: cronSQL
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        success: false,
        error: 'Não foi possível criar cron job via REST',
        details: errorText
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Cron job criado com sucesso',
      schedule: '0 2 * * * (todo dia às 2h da manhã)',
      job_name: 'cmv-semanal-auto-diario'
    });
    
  } catch (error: any) {
    console.error('Erro ao criar cron job:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/create-cron
 * Lista cron jobs existentes
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseKey) {
      return NextResponse.json({ 
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY não configurada'
      }, { status: 500 });
    }
    
    // Listar cron jobs
    const listSQL = `SELECT * FROM cron.job;`;
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({ 
        sql: listSQL
      })
    });
    
    if (!response.ok) {
      return NextResponse.json({ 
        success: false,
        error: 'Não foi possível listar cron jobs'
      }, { status: 500 });
    }
    
    const result = await response.json();
    
    return NextResponse.json({ 
      success: true,
      cron_jobs: result
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}
