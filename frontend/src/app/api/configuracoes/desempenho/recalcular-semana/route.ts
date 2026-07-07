import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Recalcula uma semana de gold.desempenho.
 * Escritor CANONICO: etl_gold_desempenho_semanal (o v2 foi descontinuado como escritor;
 * etl_gold e superset — ver migration 20260602_gold_atracao_from_eventos).
 */
export async function POST(request: NextRequest) {
  await authenticateUser(request);
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

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).rpc('etl_gold_desempenho_semanal', {
      p_bar_id: bar_id,
      p_ano: ano,
      p_semana: semanaFinal,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Semana ${semanaFinal}/${ano} recalculada para bar ${bar_id}`,
      result: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro ao recalcular semana:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
