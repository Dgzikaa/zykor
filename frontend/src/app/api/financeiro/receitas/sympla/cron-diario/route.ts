import { NextRequest, NextResponse } from 'next/server';
import { lancarSymplaLote } from '../lancar/route';
import { getAutoConfig } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Cron diário Sympla → CA — 14:00 BRT (17:00 UTC), DEPOIS da reverificação de cancelados
 * (10:00 BRT). Lança como conta a receber (pendente) os eventos já passados de D+2 (últimos
 * dias) com líquido > 0. Idempotente (financial.sympla_ca_log). Bar 3. Protegido pelo CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const BARES = [3];
  const resultados: any[] = [];
  for (const barId of BARES) {
    // Gate do toggle "Lançamento automático" (financial.lancamento_auto_config).
    const cfg = await getAutoConfig(barId, 'sympla');
    if (!cfg.ativo) { resultados.push({ bar_id: barId, skipped: true, motivo: 'automático desligado' }); continue; }
    try {
      const lote = await lancarSymplaLote(barId, 'cron 14:00 BRT');
      resultados.push({ bar_id: barId, lancados: lote.filter((x) => x.ok).length, total: lote.length, lote });
    } catch (e: any) {
      resultados.push({ bar_id: barId, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, resultados });
}
