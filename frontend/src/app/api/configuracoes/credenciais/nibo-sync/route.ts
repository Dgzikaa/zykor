import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Função auxiliar para sincronização
async function executeNiboSync(barId?: string, syncMode?: string, dateStart?: string, dateEnd?: string) {
  try {
    // Se não tiver barId no body, usar variável de ambiente (cron job)
    const targetBarId = barId || process.env.NIBO_BAR_ID;
    const targetSyncMode = syncMode || 'continuous';

    if (!targetBarId) {
      throw new Error('Bar ID é obrigatório (via body ou variável de ambiente NIBO_BAR_ID)');
    }

    // Horário atual no fuso de São Paulo
    const agoraBrasil = toZonedTime(new Date(), 'America/Sao_Paulo');

    // Buscar credenciais do Nibo na tabela api_credentials
    const { data: credenciais, error: credError } = await supabase
      .from('api_credentials')
      .select('*')
      .eq('sistema', 'nibo')
      .eq('bar_id', targetBarId)
      .eq('ativo', true)
      .single();

    if (credError || !credenciais) {
      throw new Error(`Credenciais do Nibo não encontradas para o bar_id ${targetBarId}`);
    }

    // Log da sincronização
    const logData = {
      bar_id: parseInt(targetBarId),
      tipo_sincronizacao: targetSyncMode === 'retroativo' ? 'retroativo_manual' : 'automatica_vercel',
      status: 'iniciado',
      data_inicio: new Date().toISOString(),
      criado_em: new Date().toISOString()
    };

    // Inserir log de início
    const { data: logInicio, error: logError } = await supabase
      .from('nibo_logs_sincronizacao')
      .insert(logData)
      .select()
      .single();

    if (logError) {
      console.error('Erro ao criar log de início:', logError);
    }

    // ✅ CHAMADA REAL para a Edge Function do NIBO
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/nibo-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barId: targetBarId,
        cronSecret: 'vercel_cron',
        sync_mode: targetSyncMode,
        date_start: dateStart,
        date_end: dateEnd
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function falhou: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Atualizar log com sucesso
    if (logInicio) {
      await supabase
        .from('nibo_logs_sincronizacao')
        .update({
          status: 'concluido',
          data_fim: new Date().toISOString(),
          mensagem_erro: null
        })
        .eq('id', logInicio.id);
    }

    return {
      success: true,
      message: `Sincronização com Nibo executada com sucesso para bar_id: ${targetBarId}`,
      timestamp: format(agoraBrasil, 'dd/MM/yyyy HH:mm:ss'),
      log_id: logInicio?.id,
      edge_function_result: result
    };

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    
    // Log de erro
    try {
      await supabase
        .from('nibo_logs_sincronizacao')
        .insert({
          bar_id: parseInt(barId || process.env.NIBO_BAR_ID || '0'),
          tipo_sincronizacao: 'automatica_vercel',
          status: 'erro',
          data_inicio: new Date().toISOString(),
          data_fim: new Date().toISOString(),
          mensagem_erro: error instanceof Error ? error.message : 'Erro desconhecido',
          criado_em: new Date().toISOString()
        });
    } catch (logError) {
      console.error('Erro ao criar log de erro:', logError);
    }

    throw error;
  }
}

// GET - Para cron job do Vercel
export async function GET() {
  try {
    const result = await executeNiboSync();
    
    return NextResponse.json(result, { status: 200 });
    
  } catch (error) {
    console.error('❌ Erro no cron job:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'dd/MM/yyyy HH:mm:ss')
      }, 
      { status: 500 }
    );
  }
}

// POST - Para chamadas manuais
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { barId, sync_mode, date_start, date_end } = body;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'barId é obrigatório no body' },
        { status: 400 }
      );
    }

    const modoSync = sync_mode || 'continuous';

    const result = await executeNiboSync(barId, modoSync, date_start, date_end);
    
    return NextResponse.json(result, { status: 200 });
    
  } catch (error) {
    console.error('❌ Erro na sincronização manual:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'dd/MM/yyyy HH:mm:ss')
      }, 
      { status: 500 }
    );
  }
}
