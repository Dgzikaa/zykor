import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min para recálculo completo

/**
 * Recálculo completo de todas as semanas de desempenho.
 * Usa a Edge Function desempenho-semanal-auto com recalcular_todas: true.
 * Aplica a lógica atualizada (ex: stockout alinhado com Ferramentas).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('URL do Supabase não configurada');

    const response = await fetch(
      `${supabaseUrl}/functions/v1/desempenho-semanal-auto`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recalcular_todas: true }),
      }
    );

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: `Recalculadas ${result.recalculadas || 0} semanas`,
        result,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || 'Erro no recálculo', result },
      { status: response.status }
    );
  } catch (error) {
    console.error('Recálculo completo:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
