import { NextRequest, NextResponse } from 'next/server';
import { getPainelExecutivo } from './data';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

/**
 * GET /api/estrategico/painel-executivo?bar_id=3
 * Pulso do negócio: DRE (receita/lucro YTD + mês), CMV, fluxo de caixa, RFM.
 * Lógica em ./data.ts (getPainelExecutivo) — compartilhada com o Server Component da página.
 */
export async function GET(req: NextRequest) {
  const barId = Number(req.nextUrl.searchParams.get('bar_id'));
  if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
  const out = await getPainelExecutivo(barId);
  return NextResponse.json(out);
}
