import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/fluxo-caixa-real?saldo_inicial=100000&dias=60
 * Fluxo de caixa REAL: saldo atual + entradas projetadas − contas a pagar comprometidas (CA).
 * Saldo acumulado por dia + quando aperta (menor saldo). Sempre por bar do usuário.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const saldoInicial = Number(sp.get('saldo_inicial') || '0') || 0;
  const dias = Math.min(Math.max(parseInt(sp.get('dias') || '60'), 7), 120);

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).rpc('fluxo_caixa_real', {
    p_bar_id: user.bar_id, p_saldo_inicial: saldoInicial, p_dias: dias,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = (data || []).map((r: any) => ({
    dia: r.dia, entradas: Number(r.entradas), saidas: Number(r.saidas), saldo: Number(r.saldo),
  }));
  const totalEntradas = linhas.reduce((s: number, r: any) => s + r.entradas, 0);
  const totalSaidas = linhas.reduce((s: number, r: any) => s + r.saidas, 0);
  const menor = linhas.reduce((m: any, r: any) => (!m || r.saldo < m.saldo ? r : m), null as any);

  return NextResponse.json({
    success: true,
    linhas,
    resumo: {
      saldo_inicial: saldoInicial,
      saldo_final: linhas.length ? linhas[linhas.length - 1].saldo : saldoInicial,
      total_entradas: Math.round(totalEntradas * 100) / 100,
      total_saidas: Math.round(totalSaidas * 100) / 100,
      menor_saldo: menor ? menor.saldo : saldoInicial,
      menor_saldo_dia: menor ? menor.dia : null,
      negativo: !!menor && menor.saldo < 0,
    },
  });
}
