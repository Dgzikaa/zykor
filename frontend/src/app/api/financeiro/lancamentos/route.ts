import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const meses = Number(sp.get('meses') ?? 3);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const desde = new Date();
    desde.setMonth(desde.getMonth() - meses);
    const desdeIso = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await (supabase as any).schema('financial').from('contaazul_mes_categoria')
      .select('*').eq('bar_id', barId).gte('mes', desdeIso)
      .order('mes', { ascending: false }).order('bruto', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ linhas: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
