import { NextRequest, NextResponse } from 'next/server';
import { executarConsumacaoDia } from '../consumacao/route';
import { getAutoConfig, autoDeveLancarData, ontemBRT } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron DIÁRIO das Consumações → Conta Azul, sempre do DIA ANTERIOR. Cada bar só roda se o toggle
 * "Lançamento automático" estiver LIGADO e o dia for >= o corte (só os novos). Idempotente.
 * Protegido pelo CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const dia = ontemBRT();
  const BARES = [3, 4]; // o toggle (default off) decide de verdade quem roda
  const resultados: any[] = [];
  for (const barId of BARES) {
    const cfg = await getAutoConfig(barId, 'consumacao');
    if (!cfg.ativo) { resultados.push({ bar_id: barId, skipped: true, motivo: 'automático desligado' }); continue; }
    if (!autoDeveLancarData(cfg.cutoff, dia)) { resultados.push({ bar_id: barId, skipped: true, motivo: 'antes do corte' }); continue; }
    try {
      const r = await executarConsumacaoDia(barId, dia, 'cron diário fechamento');
      resultados.push({ bar_id: barId, status: r.status, ...r.body });
    } catch (e: any) {
      resultados.push({ bar_id: barId, status: 500, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, dia, resultados });
}
