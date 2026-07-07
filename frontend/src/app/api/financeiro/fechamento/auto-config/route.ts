import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import { getLancadorAdmin } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Liga/desliga o lançamento AUTOMÁTICO (cron) por (bar, tipo). O botão manual não depende disto.
 *  - GET ?bar_id : { config: { <tipo>: { ativo, cutoff } } } de todos os tipos.
 *  - PUT { bar_id?, tipo, ativo } : liga/desliga. Ao LIGAR (estava desligado), grava cutoff = agora
 *    (o automático passa a valer só pros novos; o histórico segue manual).
 */

const TIPOS = ['stone', 'sympla', 'entrada_dinheiro', 'variacao_estoque', 'consumacao', 'imposto', 'ajuste_virada'];

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || Number(user.bar_id);

  const supabase = getLancadorAdmin();
  const { data } = await (supabase.schema('financial' as any) as any)
    .from('lancamento_auto_config').select('tipo, ativo, cutoff').eq('bar_id', barId);
  const config: Record<string, { ativo: boolean; cutoff: string | null }> = {};
  for (const t of TIPOS) config[t] = { ativo: false, cutoff: null };
  for (const r of ((data as any[]) || [])) config[(r as any).tipo] = { ativo: !!(r as any).ativo, cutoff: (r as any).cutoff || null };
  return NextResponse.json({ bar_id: barId, config });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para alterar automação');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const tipo = String(body?.tipo || '');
  const ativo = !!body?.ativo;
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 });

  const supabase = getLancadorAdmin();
  const tbl = () => (supabase.schema('financial' as any) as any).from('lancamento_auto_config');
  const { data: atual } = await tbl().select('ativo, cutoff').eq('bar_id', barId).eq('tipo', tipo).maybeSingle();

  // Só (re)grava o corte quando LIGA algo que estava desligado — ativar = "só os novos daqui pra frente".
  let cutoff: string | null = (atual as any)?.cutoff ?? null;
  if (ativo && !(atual as any)?.ativo) cutoff = new Date().toISOString();

  const { error } = await tbl().upsert({
    bar_id: barId, tipo, ativo, cutoff, updated_by: user.email ?? user.nome ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'bar_id,tipo' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, bar_id: barId, tipo, ativo, cutoff });
}
