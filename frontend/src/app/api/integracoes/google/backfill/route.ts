import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { syncGmnPeriodo } from '@/lib/receitas/marketing-semanal-sync';

/**
 * POST /api/integracoes/google/backfill  { bar_id, desde?: 'YYYY-MM-DD' }
 *
 * Reconstrói meta.marketing_semanal.gmn_* do bar direto da API do Google, semana a semana.
 * Existe porque o histórico foi digitado à mão no dia em que a semana fechava — e o Google
 * consolida com atraso, então todo número antigo ficou MENOR que o real (semana 29/2026:
 * 11.404 digitado vs 15.171 real). Depois desta rota, a série inteira vem da mesma fonte.
 *
 * É uma chamada só à API do Google (o período inteiro de uma vez), então rodar 18 meses
 * custa praticamente o mesmo que rodar uma semana.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** A Performance API guarda ~18 meses; pedir mais que isso volta vazio, não dá erro. */
const MESES_MAX = 18;

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg = negarPorRota(user, req);
  if (neg) return neg;

  try {
    const body = await req.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setUTCMonth(limite.getUTCMonth() - MESES_MAX);

    const pedido = typeof body?.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.desde)
      ? new Date(`${body.desde}T00:00:00Z`)
      : limite;
    // Nunca pedir antes do limite da API — economiza a chamada que voltaria vazia.
    const desde = pedido < limite ? limite : pedido;

    const resultado = await syncGmnPeriodo(
      barId,
      desde.toISOString().slice(0, 10),
      hoje.toISOString().slice(0, 10),
    );

    return NextResponse.json({ success: true, resultado });
  } catch (e: any) {
    console.error('[google/backfill] erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
