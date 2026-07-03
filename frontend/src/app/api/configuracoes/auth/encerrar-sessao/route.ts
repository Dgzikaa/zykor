import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * POST { email } — encerra a sessão de UM usuário (admin). Seta o corte por usuário
 * (system.user_token_cutoff) pra agora → o token dele é rejeitado no authenticateUser e ele cai
 * no /login. Também marca as sessões abertas dele como encerradas. Não afeta os outros.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Apenas admin' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ success: false, error: 'email obrigatório' }, { status: 400 });

  const agora = Math.floor(Date.now() / 1000); // epoch (segundos), igual ao iat do JWT
  const supabase = await getAdminClient();

  const { error } = await (supabase as any).schema('system').from('user_token_cutoff')
    .upsert({ email, min_iat: agora, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // encerra as sessões abertas desse usuário (best-effort)
  try {
    await (supabase as any).schema('system').from('user_sessions')
      .update({ ended_at: new Date().toISOString(), end_reason: 'encerrada_admin' })
      .eq('user_email', email).is('ended_at', null);
  } catch { /* noop */ }

  return NextResponse.json({ success: true, email, message: 'Sessão encerrada — o usuário cairá no login na próxima ação (até ~1min).' });
}
