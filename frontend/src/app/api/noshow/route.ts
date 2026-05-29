import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();
    const [{ data: resumo }, { data: reincidentes }] = await Promise.all([
      (supabase as any).schema('gold').from('noshow_resumo').select('*').eq('bar_id', barId).maybeSingle(),
      (supabase as any).schema('gold').from('noshow_reincidentes').select('*').eq('bar_id', barId).limit(100),
    ]);

    return NextResponse.json({ resumo, reincidentes: reincidentes ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
