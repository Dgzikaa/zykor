import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// GET — passthrough enxuto do gold.desempenho SEMANAL (materializado) p/ os gráficos.
// Devolve as N últimas semanas (por data_fim) com TODAS as colunas ricas: faturamento
// (couvert/bar/cmvivel), mix (perc_bebidas/drinks/comida), stockout por área, reservas
// (totais/presentes/no-show/quebra), tempos e atrasos, NPS por dimensão, CMO, etc.
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
  const semanas = Math.min(160, Math.max(4, parseInt(new URL(request.url).searchParams.get('semanas') || '52', 10)));

  const { data, error } = await (supabase as any).schema('gold')
    .from('desempenho')
    .select('*')
    .eq('bar_id', barId)
    .eq('granularidade', 'semanal')
    .order('data_fim', { ascending: false })
    .limit(semanas);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = [...(data || [])].sort((a: any, b: any) => (a.data_fim < b.data_fim ? -1 : 1));
  return NextResponse.json({ success: true, semanas: linhas });
}
