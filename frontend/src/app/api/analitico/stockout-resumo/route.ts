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
 * Retorna apenas o resumo de stockout do dia (sem listas detalhadas).
 * Usado pelo card "Stockout" no header de /analitico/eventos.
 *
 * Fonte: silver.silver_contahub_operacional_stockout_processado (incluido=true)
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
        },
      });
    }

    const { data, error } = await supabase
      .schema('silver' as never)
      .from('silver_contahub_operacional_stockout_processado')
      .select('prd_ativo')
      .eq('data_consulta', dataSelecionada)
      .eq('bar_id', barId)
      .eq('incluido', true);

    if (error) {
      console.error('[stockout-resumo] erro Supabase:', error);
      return NextResponse.json({ error: 'Erro ao consultar stockout' }, { status: 500 });
    }

    const linhas = data ?? [];
    const total = linhas.length;
    const ativos = linhas.filter((r: any) => r.prd_ativo === 'S' || r.prd_ativo === 'true').length;
    const stockout = total - ativos;
    const pct = total > 0 ? ((stockout / total) * 100).toFixed(1) : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        total_produtos_ativos: total,
        produtos_stockout: stockout,
        percentual_stockout: `${pct}%`,
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
