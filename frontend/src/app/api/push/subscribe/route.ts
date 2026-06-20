import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/subscribe — salva a Web Push subscription do usuário logado.
 * Body: { endpoint, p256dh, auth, bar_id?, user_agent? }
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ success: false, error: 'subscription incompleta' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { error } = await supabase.from('push_subscriptions').upsert({
    usuario_id: user.auth_id,
    bar_id: body.bar_id ?? user.bar_id ?? null,
    endpoint: body.endpoint,
    p256dh: body.p256dh,
    auth: body.auth,
    user_agent: body.user_agent || null,
    ativo: true,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'endpoint' });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
