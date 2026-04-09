import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cmv-mensal/sync-sheets
 * Dispara sincronização do CMV Mensal a partir da planilha do Google Sheets
 * Busca dados da aba "CMV Mensal" e sincroniza com a tabela cmv_mensal
 * 
 * Body: { bar_id: number, ano?: number, debug?: boolean } 
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = body.bar_id;
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    const ano = body.ano; // opcional - ano específico
    const debug = body.debug || false; // opcional - modo debug
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }

    console.log('📊 Iniciando sincronização CMV Mensal do Google Sheets...', { barId, ano, debug });

    const response = await fetch(`${supabaseUrl}/functions/v1/sync-cmv-mensal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        bar_id: barId,
        ano: ano,
        debug: debug
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro no sync-cmv-mensal:', result);
      return NextResponse.json(
        { error: result.error || 'Erro ao sincronizar planilha CMV Mensal' },
        { status: response.status }
      );
    }

    console.log('✅ CMV Mensal sincronizado:', result);

    return NextResponse.json({
      success: true,
      message: result.message || 'CMV Mensal sincronizado com sucesso',
      resultados: result.resultados_por_bar || result.resultados
    });
    
  } catch (error: any) {
    console.error('❌ Erro no sync-sheets CMV Mensal:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

// GET - Retorna informações sobre o endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cmv-mensal/sync-sheets',
    method: 'POST',
    description: 'Sincroniza CMV Mensal da planilha do Google Sheets (aba "CMV Mensal")',
    body: {
      bar_id: 'ID do bar (padrão: 3)',
      ano: 'Ano específico (opcional)',
      debug: 'Modo debug (opcional, padrão: false)'
    },
    exemplo: {
      bar_id: 3,
      ano: 2026,
      debug: false
    }
  });
}
