import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, ano, semana, numero_semana } = body;

    const semanaFinal = numero_semana || semana;

    if (!bar_id || !ano || !semanaFinal) {
      return NextResponse.json(
        { error: 'Parâmetros bar_id, ano e semana (ou numero_semana) são obrigatórios' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('URL do Supabase não configurada');

    const response = await fetch(
      `${supabaseUrl}/functions/v1/recalcular-desempenho-v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          bar_id, 
          ano, 
          numero_semana: semanaFinal,
          mode: 'write'
        }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: `Semana ${semanaFinal}/${ano} recalculada para bar ${bar_id}`,
        result,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || 'Erro no recálculo', result },
      { status: response.status }
    );
  } catch (error: any) {
    console.error('Erro ao recalcular semana:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
