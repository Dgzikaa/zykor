import { NextRequest, NextResponse } from 'next/server';
import { executarStoneDiario, ontemBRT } from '../contas-a-receber-diario/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron diário Stone→CA — 06:00 BRT (09:00 UTC). Lança sempre o DIA ANTERIOR (ontemBRT):
 * ex.: 03/07 às 06:00 → lança o dia 02/07. Idempotente (o log impede duplicar).
 * Bar 3 (Ordinário). Protegido pelo CRON_SECRET (Vercel injeta Authorization: Bearer <secret>).
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
    try {
      const r = await executarStoneDiario(barId, data, 'cron 06:00 BRT');
      resultados.push({ bar_id: barId, status: r.status, ...r.body });
    } catch (e: any) {
      resultados.push({ bar_id: barId, status: 500, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, data, resultados });
}
