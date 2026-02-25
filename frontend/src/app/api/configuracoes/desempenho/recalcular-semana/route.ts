import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, ano, semana } = body;

    if (!bar_id || !ano || !semana) {
      return NextResponse.json(
        { error: 'Parâmetros bar_id, ano e semana são obrigatórios' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('URL do Supabase não configurada');

    console.log(`🔄 Recalculando semana ${semana}/${ano} para bar ${bar_id}...`);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/desempenho-semanal-auto`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bar_id, ano, semana }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Semana ${semana}/${ano} recalculada com sucesso!`);
      return NextResponse.json({
        success: true,
        message: `Semana ${semana}/${ano} recalculada`,
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
