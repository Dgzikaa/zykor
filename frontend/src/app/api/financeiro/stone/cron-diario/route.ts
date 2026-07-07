import { NextRequest, NextResponse } from 'next/server';
import { executarStoneDiario, ontemBRT } from '../contas-a-receber-diario/route';
import { getAutoConfig, autoDeveLancarData } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron diário Stone→CA — 08:00 BRT (11:00 UTC). Roda DEPOIS da ingestão da Stone do dia
 * (cartão sync 07:00 + parse 07:20 BRT; PIX 04:10) pra ter o dia completo. Lança sempre o
 * DIA ANTERIOR (ontemBRT): ex.: 03/07 às 08:00 → lança o dia 02/07. Idempotente (log impede
 * duplicar). Bar 3 (Ordinário). Protegido pelo CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const data = ontemBRT();
  const BARES = [3]; // bares configurados p/ Stone→CA (estender quando ligar o bar 4)
  const resultados: any[] = [];
  for (const barId of BARES) {
    // Gate do toggle "Lançamento automático" (financial.lancamento_auto_config).
    const cfg = await getAutoConfig(barId, 'stone');
    if (!cfg.ativo) { resultados.push({ bar_id: barId, skipped: true, motivo: 'automático desligado' }); continue; }
    if (!autoDeveLancarData(cfg.cutoff, data)) { resultados.push({ bar_id: barId, skipped: true, motivo: 'antes do corte da automação' }); continue; }
    try {
      const r = await executarStoneDiario(barId, data, 'cron 08:00 BRT');
      resultados.push({ bar_id: barId, status: r.status, ...r.body });
    } catch (e: any) {
      resultados.push({ bar_id: barId, status: 500, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, data, resultados });
}
