import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min para recálculo completo

/**
 * Recálculo completo das semanas de gold.desempenho.
 * Escritor CANONICO: etl_gold_desempenho_all_bars (o v2 foi descontinuado como escritor).
 */
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await getAdminClient();
    // janela ampla (~14 meses) para cobrir todas as semanas com dados
    const { data, error } = await (supabase as any).rpc('etl_gold_desempenho_all_bars', {
      p_dias_atras: 430,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Recálculo completo (etl_gold_desempenho_all_bars)',
      result: data,
      timestamp: new Date().toISOString(),
    });
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
