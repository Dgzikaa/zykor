import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      bar_id,
      start_date,
      end_date,
      data_types = ['analitico'],
      delay_ms = 2000,
      process_after = true
    } = body;

    if (!bar_id) {
      return NextResponse.json({
        error: 'bar_id é obrigatório'
      }, { status: 400 });
    }

    if (!start_date || !end_date) {
      return NextResponse.json({
        error: 'start_date e end_date são obrigatórios (formato YYYY-MM-DD)'
      }, { status: 400 });
    }

    // Chamar a Edge Function
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/contahub-sync-retroativo`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        bar_id,
        start_date,
        end_date,
        data_types,
        delay_ms,
        process_after
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na Edge Function:', errorText);
      return NextResponse.json({ 
        error: `Erro na Edge Function: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    const result = await response.json();

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Sincronização Retroativa do ContaHub',
    metodo: 'POST',
    descricao: 'Busca dados históricos do ContaHub e salva no Supabase',
    parametros: {
      bar_id: 'ID do bar (obrigatório)',
      start_date: 'Data inicial YYYY-MM-DD (obrigatório)',
      end_date: 'Data final YYYY-MM-DD (obrigatório)',
      data_types: 'Array de tipos: analitico, fatporhora, pagamentos, periodo, tempo (padrão: ["analitico"])',
      delay_ms: 'Delay entre dias em ms (padrão: 2000)',
      process_after: 'Processar após coleta (padrão: true)'
    },
    exemplo: {
      start_date: '2025-09-01',
      end_date: '2025-09-30',
      data_types: ['analitico']
    }
  });
}
