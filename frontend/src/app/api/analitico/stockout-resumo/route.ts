import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarBarAberto } from '@/lib/helpers/calendario-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/analitico/stockout-resumo?data=YYYY-MM-DD&bar_id=N
 *
 * Resumo do stockout do dia (usado no header de /analitico/eventos).
 * Fonte: RPC `public.calcular_stockout_dia` — mesma fórmula da
 * /ferramentas/stockout (incluido=true + filtra Feijoada em não-sábados).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataSelecionada = searchParams.get('data');
    const barIdParam = searchParams.get('bar_id');

    if (!dataSelecionada) {
      return NextResponse.json({ error: 'Parâmetro "data" é obrigatório' }, { status: 400 });
    }
    if (!barIdParam) {
      return NextResponse.json({ error: 'Parâmetro "bar_id" é obrigatório' }, { status: 400 });
    }

    const barId = Number(barIdParam);
    if (!Number.isFinite(barId) || barId <= 0) {
      return NextResponse.json({ error: 'bar_id inválido' }, { status: 400 });
    }

    const statusDia = await verificarBarAberto(dataSelecionada, barId);
    if (!statusDia.aberto) {
      return NextResponse.json({
        success: true,
        bar_fechado: true,
        motivo: statusDia.motivo,
        data: {
          total_produtos_ativos: 0,
          produtos_stockout: 0,
          percentual_stockout: '0%',
          por_categoria: [],
        },
      });
    }

    const { data, error } = await supabase.rpc('calcular_stockout_dia', {
      p_bar_id: barId,
      p_data: dataSelecionada,
    });

    if (error) {
      console.error('[stockout-resumo] RPC erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Row = { categoria: string; total: number; stockout: number; disponiveis: number; pct_stockout: number };
    const rows = (data ?? []) as Row[];
    const total = rows.find(r => r.categoria === 'TOTAL');
    const categorias = rows.filter(r => r.categoria !== 'TOTAL');

    return NextResponse.json({
      success: true,
      data: {
        total_produtos_ativos: total?.total ?? 0,
        produtos_stockout: total?.stockout ?? 0,
        produtos_disponiveis: total?.disponiveis ?? 0,
        percentual_stockout: `${Number(total?.pct_stockout ?? 0).toFixed(2)}%`,
        por_categoria: categorias.map(c => ({
          categoria: c.categoria,
          total: c.total,
          stockout: c.stockout,
          disponiveis: c.disponiveis,
          pct: `${Number(c.pct_stockout ?? 0).toFixed(2)}%`,
        })),
      },
    });
  } catch (err) {
    console.error('[stockout-resumo] exceção:', err);
    return NextResponse.json(
      { error: 'Erro interno', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
