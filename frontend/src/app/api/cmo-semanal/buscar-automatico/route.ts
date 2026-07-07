import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cmo-semanal/buscar-automatico
 * Busca automática dos componentes de CMO (mão de obra) da semana a partir de
 * silver.lancamento_classificado (bloco 'Mão-de-Obra'). Hoje traz `freelas`
 * (categoria FREELA*). NÃO traz CMA — custo de alimentação não é CMO.
 * Body: { bar_id, data_inicio, data_fim }
 *
 * Este endpoint não existia — o botão "buscar dados automáticos" do CMOSimulador
 * fazia POST num 404 e caía no toast de erro.
 */
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const { bar_id, data_inicio, data_fim } = await request.json();
    if (!bar_id || !data_inicio || !data_fim) {
      return NextResponse.json(
        { success: false, error: 'bar_id, data_inicio e data_fim são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await (supabase as any)
      .schema('silver')
      .from('lancamento_classificado')
      .select('valor_bruto')
      .eq('bar_id', bar_id)
      .eq('is_ignorado', false)
      .eq('bloco_dre', 'Mão-de-Obra')
      .ilike('categoria_zykor', 'FREELA%')
      .gte('data_competencia', data_inicio)
      .lte('data_competencia', data_fim)
      .limit(5000);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const freelas = (data || []).reduce(
      (s: number, r: { valor_bruto: number | null }) => s + Number(r.valor_bruto || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: { freelas: Math.round(freelas * 100) / 100 },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: (e as Error)?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
