import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
  try {
    const supabase = await getAdminClient();
    const { data: logs } = await (supabase as any).schema('bronze' as any).from('bronze_contaazul_sync_log')
      .select('id, bar_id, tipo_sync, status, itens_processados, duracao_ms, criado_em, erro_msg')
      .order('criado_em', { ascending: false }).limit(30);
    const lista = logs ?? [];
    const ultima_por_bar: Record<number, any> = {};
    for (const l of lista) if (!ultima_por_bar[l.bar_id]) ultima_por_bar[l.bar_id] = l;
    return NextResponse.json({ logs: lista, ultima_por_bar });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
