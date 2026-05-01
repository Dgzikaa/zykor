import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getWeekDateRange(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '0');
    const ano = parseInt(searchParams.get('ano') || String(new Date().getFullYear()));
    const semana = parseInt(searchParams.get('semana') || '0');

    if (!barId || !semana) {
      return NextResponse.json({ error: 'bar_id e semana sao obrigatorios' }, { status: 400 });
    }

    const { start, end } = getWeekDateRange(ano, semana);

    // Pendencias (sem categoria)
    const { data: pendencias, error: errPend } = await supabase.rpc('get_consumos_sem_categoria_semana', {
      input_bar_id: barId,
      input_data_inicio: start,
      input_data_fim: end,
    });
    if (errPend) throw errPend;

    // Categorizado (pra calcular cobertura)
    const { data: categorizado, error: errCat } = await supabase.rpc('get_consumos_classificados_semana', {
      input_bar_id: barId,
      input_data_inicio: start,
      input_data_fim: end,
    });
    if (errCat) throw errCat;

    const totalCategorizado = (categorizado || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.total) || 0), 0
    );
    const totalSemPadrao = (pendencias || []).reduce(
      (sum: number, r: any) => sum + (parseFloat(r.total_desconto) || 0), 0
    );
    const totalGeral = totalCategorizado + totalSemPadrao;
    const pctCobertura = totalGeral > 0 ? (totalCategorizado / totalGeral) * 100 : 100;

    return NextResponse.json({
      periodo: { ano, semana, data_inicio: start, data_fim: end },
      cobertura: {
        total_categorizado: totalCategorizado,
        total_sem_padrao: totalSemPadrao,
        total_geral: totalGeral,
        pct_cobertura: Math.round(pctCobertura * 100) / 100,
      },
      categorizado: categorizado || [],
      pendencias: pendencias || [],
    });
  } catch (err: any) {
    console.error('Erro GET consumos-classificacao:', err);
    return NextResponse.json({ error: err.message || 'Erro ao buscar' }, { status: 500 });
  }
}
