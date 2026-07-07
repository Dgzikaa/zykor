import { NextRequest, NextResponse } from 'next/server';
import { executarVariacaoEstoque } from '../variacao-estoque/route';
import { executarImpostos } from '../impostos/route';
import { executarAjusteVirada } from '../ajuste-virada/route';
import { getAutoConfig, autoDeveLancarData, mesAnteriorBRT, ultimoDiaMes } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Cron MENSAL dos fechamentos → Conta Azul (Variação de Estoque, Impostos, Ajuste Virada),
 * sempre do MÊS ANTERIOR. Cada (bar, tipo) só roda se o toggle "Lançamento automático" estiver
 * LIGADO e a competência for >= o corte (só os novos). Idempotente. Protegido pelo CRON_SECRET.
 */
const JOBS: { tipo: string; fn: (b: number, a: number, m: number, quem: string | null) => Promise<{ status: number; body: any }> }[] = [
  { tipo: 'variacao_estoque', fn: executarVariacaoEstoque },
  { tipo: 'imposto', fn: executarImpostos },
  { tipo: 'ajuste_virada', fn: executarAjusteVirada },
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const { ano, mes } = mesAnteriorBRT();
  const competencia = ultimoDiaMes(ano, mes);
  const BARES = [3, 4]; // o toggle (default off) decide de verdade quem roda
  const resultados: any[] = [];
  for (const barId of BARES) {
    for (const j of JOBS) {
      const cfg = await getAutoConfig(barId, j.tipo);
      if (!cfg.ativo) { resultados.push({ bar_id: barId, feature: j.tipo, skipped: true, motivo: 'automático desligado' }); continue; }
      if (!autoDeveLancarData(cfg.cutoff, competencia)) { resultados.push({ bar_id: barId, feature: j.tipo, skipped: true, motivo: 'antes do corte' }); continue; }
      try {
        const r = await j.fn(barId, ano, mes, 'cron mensal fechamento');
        resultados.push({ bar_id: barId, feature: j.tipo, status: r.status, ...r.body });
      } catch (e: any) {
        resultados.push({ bar_id: barId, feature: j.tipo, status: 500, error: e?.message || String(e) });
      }
    }
  }
  return NextResponse.json({ ok: true, ano, mes, resultados });
}
