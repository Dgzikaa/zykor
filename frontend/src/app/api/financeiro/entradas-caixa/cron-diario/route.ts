import { NextRequest, NextResponse } from 'next/server';
import { executarEntradaDiaria, ontemBRT } from '../contas-a-receber-diario/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Cron diário Entradas de Caixa (dinheiro) → CA — 12:00 BRT (15:00 UTC). Lança sempre o DIA
 * ANTERIOR (ontemBRT): soma o dinheiro recebido do dia e cria 1 conta a receber já baixada.
 * Idempotente (log impede duplicar). Bar 3 primeiro; estender BARES p/ o 4 depois de validar.
 * Protegido pelo CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const data = ontemBRT();
  const BARES = [3]; // estender p/ [3, 4] quando o bar 4 estiver validado
  const resultados: any[] = [];
  for (const barId of BARES) {
    try {
      const r = await executarEntradaDiaria(barId, data, 'cron 12:00 BRT');
      resultados.push({ bar_id: barId, status: r.status, ...r.body });
    } catch (e: any) {
      resultados.push({ bar_id: barId, status: 500, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, data, resultados });
}
