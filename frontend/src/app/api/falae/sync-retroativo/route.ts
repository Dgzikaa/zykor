import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body.bar_id);
    const dataInicio = body.data_inicio; // formato: YYYY-MM-DD
    const dataFim = body.data_fim || new Date().toISOString().split('T')[0];

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    if (!dataInicio) {
      return NextResponse.json({ error: 'data_inicio é obrigatória (formato: YYYY-MM-DD)' }, { status: 400 });
    }

    // Calcular days_back baseado nas datas
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const daysBack = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`🔄 Sincronização retroativa do Falaê`);
    console.log(`📅 Período: ${dataInicio} até ${dataFim} (${daysBack} dias)`);
    console.log(`🏪 Bar ID: ${barId}`);

    // Chamar a API de sync existente
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const syncResponse = await fetch(`${baseUrl}/api/falae/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bar_id: barId,
        days_back: daysBack,
      }),
    });

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      throw new Error(`Erro na sincronização: ${syncResponse.status} - ${errorText}`);
    }

    const syncResult = await syncResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Sincronização retroativa concluída',
      periodo: {
        inicio: dataInicio,
        fim: dataFim,
        dias: daysBack,
      },
      resultado: syncResult,
    });

  } catch (error) {
    console.error('Erro na sincronização retroativa:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST para sincronizar',
    exemplo: {
      method: 'POST',
      body: {
        bar_id: 4,
        data_inicio: '2026-03-10',
        data_fim: '2026-04-01',
      },
    },
  });
}
