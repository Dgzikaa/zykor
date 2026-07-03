import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * POST — "Deslogar todo mundo" (admin). Move o corte system.auth_policy.min_iat pra agora:
 * todo token emitido antes disso passa a ser rejeitado no authenticateUser → cada usuário cai
 * no /login na próxima ação e refaz o login (registrando sessão). Reutilizável.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Apenas admin' }, { status: 403 });

  const agora = Math.floor(Date.now() / 1000); // epoch em segundos (igual ao iat do JWT)
  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema('system').from('auth_policy')
    .update({ min_iat: agora, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, min_iat: agora, message: 'Todos serão deslogados na próxima ação (pode levar até ~1min).' });
}
