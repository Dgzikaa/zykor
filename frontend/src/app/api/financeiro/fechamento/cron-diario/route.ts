import { NextRequest, NextResponse } from 'next/server';
import { executarConsumacaoDia } from '../consumacao/route';
import { getAutoConfig, autoDeveLancarData, ontemBRT } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Enumera os dias de `de` até `ate`, inclusive. Teto de 120 dias para não virar job infinito. */
function enumerarDias(de: string, ate: string): string[] {
  const out: string[] = [];
  const d = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  while (d <= fim && out.length < 120) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

/**
 * Cron DIÁRIO das Consumações → Conta Azul, sempre do DIA ANTERIOR. Cada bar só roda se o toggle
 * "Lançamento automático" estiver LIGADO e o dia for >= o corte (só os novos). Idempotente.
 * Protegido pelo CRON_SECRET.
 *
 * Aceita `?de=YYYY-MM-DD&ate=YYYY-MM-DD` (e `?bar_id=`) para reprocessar um período. Serve para
 * backfill: como `executarConsumacaoDia` agora detecta desbalanço entre despesas e contrapartida
 * e emite o complemento, reprocessar um intervalo conserta a soma-zero dos dias em que uma
 * despesa entrou depois da receita. Dias já corretos não geram nada (idempotente pelo valor).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const de = url.searchParams.get('de');
  const ate = url.searchParams.get('ate');
  const barFiltro = Number(url.searchParams.get('bar_id')) || null;
  const dias = de && ate ? enumerarDias(de, ate) : [ontemBRT()];
  const BARES = (barFiltro ? [barFiltro] : [3, 4]); // o toggle (default off) decide de verdade quem roda

  const resultados: any[] = [];
  for (const barId of BARES) {
    const cfg = await getAutoConfig(barId, 'consumacao');
    if (!cfg.ativo) { resultados.push({ bar_id: barId, skipped: true, motivo: 'automático desligado' }); continue; }
    for (const dia of dias) {
      if (!autoDeveLancarData(cfg.cutoff, dia)) { resultados.push({ bar_id: barId, dia, skipped: true, motivo: 'antes do corte' }); continue; }
      try {
        const r = await executarConsumacaoDia(barId, dia, 'cron diário fechamento');
        resultados.push({ bar_id: barId, dia, status: r.status, ...r.body });
      } catch (e: any) {
        resultados.push({ bar_id: barId, dia, status: 500, error: e?.message || String(e) });
      }
    }
  }
  return NextResponse.json({ ok: true, dias: dias.length === 1 ? dias[0] : { de, ate, n: dias.length }, resultados });
}
