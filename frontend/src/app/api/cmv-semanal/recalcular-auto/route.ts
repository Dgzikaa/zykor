import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cmv-semanal/recalcular-auto
 * Chama a Edge Function cmv-semanal-auto para recalcular/atualizar CMV
 * Busca dados do Conta Azul e ContaHub automaticamente
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = body.bar_id;
    const ano = body.ano;
    const semana = body.semana;
    const todasSemanas = body.todas_semanas || false;
    
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }

    console.log('🔄 Chamando cmv-semanal-auto...', { barId, ano, semana, todasSemanas });

    const response = await fetch(`${supabaseUrl}/functions/v1/cmv-semanal-auto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        bar_id: barId,
        ano: ano,
        semana: semana,
        todas_semanas: todasSemanas
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro no cmv-semanal-auto:', result);
      return NextResponse.json(
        { error: result.error || 'Erro ao recalcular CMV' },
        { status: response.status }
      );
    }

    console.log('✅ CMV recalculado:', result);

    return NextResponse.json({
      success: true,
      message: result.message || 'CMV recalculado com sucesso',
      data: result
    });
    
  } catch (error: any) {
    console.error('❌ Erro no recalcular-auto:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
