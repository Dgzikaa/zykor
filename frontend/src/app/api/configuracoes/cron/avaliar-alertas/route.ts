import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { avaliarCondicoesDoBar } from '@/lib/notifications/condition-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron do construtor de alertas: avalia as condições ativas (system.alert_conditions)
 * de cada bar e dispara as que baterem (com cooldown). Protegido pelo CRON_SECRET.
 * Agendado no frontend/vercel.json.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await getAdminClient();
  const { data: rows } = await supabase
    .schema('system')
    .from('alert_conditions')
    .select('bar_id')
    .eq('ativo', true);

  const bares = [...new Set(((rows ?? []) as Array<{ bar_id: number }>).map((r) => r.bar_id))];

  const resultados: Array<Record<string, unknown>> = [];
  for (const barId of bares) {
    try {
      const r = await avaliarCondicoesDoBar(barId);
      resultados.push({ barId, avaliadas: r.avaliadas, disparadas: r.disparadas });
    } catch (e) {
      resultados.push({ barId, erro: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ success: true, bares: bares.length, resultados });
}
