import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cmv-semanal/sync-sheets
 * Dispara sincronização do CMV a partir da planilha do Google Sheets
 * Busca estoques, bonificações, CMV teórico da aba "cmv semanal"
 * 
 * Body: { bar_id: number, semana?: number, ano?: number } 
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = body.bar_id || 3;
    const semana = body.semana; // opcional - semana específica
    const ano = body.ano; // opcional - ano específico
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }
    
    console.log(`🔄 Sincronizando CMV da planilha para bar_id=${barId}${semana ? ` semana=${semana}` : ''}${ano ? ` ano=${ano}` : ''}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-cmv-sheets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        bar_id: barId,
        semana: semana,
        ano: ano
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro no sync-cmv-sheets:', result);
      return NextResponse.json(
        { error: result.error || 'Erro ao sincronizar planilha' },
        { status: response.status }
      );
    }
    
    console.log(`✅ Sync concluído:`, result.message);
    
    return NextResponse.json({
      success: true,
      message: result.message || 'Planilha sincronizada com sucesso',
      resultados: result.resultados_por_bar || result.resultados
    });
    
  } catch (error: any) {
    console.error('❌ Erro no sync-sheets:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

// GET - Retorna informações sobre o endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cmv-semanal/sync-sheets',
    method: 'POST',
    description: 'Sincroniza CMV da planilha do Google Sheets (estoques, bonificações, CMV teórico)',
    body: {
      bar_id: 'ID do bar (padrão: 3)',
      semana: 'Semana específica (opcional)',
      ano: 'Ano específico (opcional)'
    },
    exemplo: {
      bar_id: 3,
      semana: 6,
      ano: 2026
    }
  });
}
