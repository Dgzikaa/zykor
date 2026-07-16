import { NextRequest, NextResponse } from 'next/server';
import { reconciliarBaixasConsumacao } from '../route';
import { authenticateUser, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// data BRT (UTC-3) 'YYYY-MM-DD' com deslocamento de dias.
function ymdBRT(offsetDias = 0): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetDias * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Reconciliação de BAIXA das consumações — quita no CA o que já sincronizou (despesa E receita,
 * caixa neutro). Roda a cada 6h. É o passo que faz a consumação "ir como pago" depois de lançada,
 * já que o CA processa o lançamento de forma assíncrona.
 *
 * Auth: Bearer CRON_SECRET (cron) OU financeiro (disparo manual — só o próprio bar).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const isCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  let bares: number[] = [3, 4];

  if (!isCron) {
    const user = await authenticateUser(request);
    if (!user || !podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'inserir')) {
      return permissionErrorResponse('Sem permissão');
    }
    const barParam = Number(new URL(request.url).searchParams.get('bar_id'));
    bares = Number.isFinite(barParam) && barParam > 0 ? [barParam] : (user.bar_id ? [user.bar_id] : []);
  }

  const de = ymdBRT(-21), ate = ymdBRT(0); // janela: baixa o que sincronizou nos últimos 21 dias
  const resultados: any[] = [];
  for (const barId of bares) {
    try {
      const r = await reconciliarBaixasConsumacao(barId, de, ate);
      resultados.push({ bar_id: barId, ...r });
    } catch (e: any) {
      resultados.push({ bar_id: barId, erro: e?.message || String(e) });
    }
  }
  return NextResponse.json({ ok: true, periodo: { de, ate }, resultados });
}
