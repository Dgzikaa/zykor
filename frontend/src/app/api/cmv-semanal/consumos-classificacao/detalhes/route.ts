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
    const categoria = searchParams.get('categoria') || '';

    if (!barId || !semana || !categoria) {
      return NextResponse.json({ error: 'bar_id, semana e categoria sao obrigatorios' }, { status: 400 });
    }

    const { start, end } = getWeekDateRange(ano, semana);

    const { data, error } = await supabase.rpc('get_consumos_detalhes_categoria', {
      input_bar_id: barId,
      input_data_inicio: start,
      input_data_fim: end,
      input_categoria: categoria,
    });

    if (error) throw error;

    return NextResponse.json({
      categoria,
      periodo: { ano, semana, data_inicio: start, data_fim: end },
      itens: data || [],
    });
  } catch (err: any) {
    console.error('Erro GET detalhes:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
