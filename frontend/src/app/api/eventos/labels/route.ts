import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// GET — labels distintas do bar (operations.eventos_base.nome), com frequência,
// pro combobox digitável do modal de evento. Pagina p/ não cortar em 1000.
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const counts = new Map<string, number>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase as any)
      .schema('operations')
      .from('eventos_base')
      .select('nome')
      .eq('bar_id', barId)
      .not('nome', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    for (const r of data || []) {
      const n = String(r.nome || '').trim();
      if (n) counts.set(n, (counts.get(n) || 0) + 1);
    }
    if (!data || data.length < pageSize) break;
  }

  const labels = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([nome, qtd]) => ({ nome, qtd }));

  return NextResponse.json({ success: true, labels });
}
