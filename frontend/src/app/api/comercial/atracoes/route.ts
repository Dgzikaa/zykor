import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/comercial/atracoes?bar_id=N&ano=YYYY
 * Atrações planejadas (gold.planejamento) por dia, para sobrepor no calendário
 * da Central Comercial. Retorna { atracoes: { 'YYYY-MM-DD': 'nome da atração' } }.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano')) || new Date().getFullYear();
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any)
      .schema('gold')
      .from('planejamento')
      .select('data_evento, nome')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .gte('data_evento', `${ano}-01-01`)
      .lte('data_evento', `${ano}-12-31`)
      .order('data_evento');
    if (error) throw error;

    const atracoes: Record<string, string> = {};
    for (const r of data ?? []) {
      if (r.data_evento && r.nome) atracoes[r.data_evento] = r.nome;
    }

    return NextResponse.json({ success: true, ano, total: Object.keys(atracoes).length, atracoes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
