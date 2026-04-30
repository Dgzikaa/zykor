import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getAdminClient();
    const { data, error } = await supabase.rpc('get_health_dashboard');

    if (error) {
      console.error('[health-dashboard] Erro RPC:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[health-dashboard] Erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
