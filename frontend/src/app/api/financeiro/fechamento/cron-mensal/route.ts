import { NextRequest, NextResponse } from 'next/server';
import { executarVariacaoEstoque } from '../variacao-estoque/route';
import { executarBonificacao } from '../bonificacoes/route';
import { mesAnteriorBRT } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Cron mensal dos lançamentos de FECHAMENTO → Conta Azul. Roda dia 05 (10:00 BRT / 13:00 UTC),
 * lançando sempre o MÊS ANTERIOR:
 *   - Variação de Estoque (3 lançamentos por categoria)
 *   - Bonificações (1 lançamento)
 * Tudo idempotente (o log impede duplicar). Bar 3 primeiro; estender BARES p/ o 4 depois de validar.
 * Protegido pelo CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 });
  }

  const { ano, mes } = mesAnteriorBRT();
  const BARES = [3]; // estender p/ [3, 4] quando o bar 4 estiver validado
  const resultados: any[] = [];
  for (const barId of BARES) {
    try {
      const ve = await executarVariacaoEstoque(barId, ano, mes, 'cron mensal fechamento');
      resultados.push({ bar_id: barId, feature: 'variacao_estoque', status: ve.status, ...ve.body });
    } catch (e: any) {
      resultados.push({ bar_id: barId, feature: 'variacao_estoque', status: 500, error: e?.message || String(e) });
    }
    try {
      const bo = await executarBonificacao(barId, ano, mes, 'cron mensal fechamento');
      resultados.push({ bar_id: barId, feature: 'bonificacao', status: bo.status, ...bo.body });
    } catch (e: any) {
      resultados.push({ bar_id: barId, feature: 'bonificacao', status: 500, error: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, ano, mes, resultados });
}
