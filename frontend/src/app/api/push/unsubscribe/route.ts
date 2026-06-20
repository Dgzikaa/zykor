import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** POST /api/push/unsubscribe — desativa a subscription (por endpoint). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  if (!body.endpoint) return NextResponse.json({ success: false, error: 'endpoint obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { error } = await supabase.from('push_subscriptions')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('endpoint', body.endpoint).eq('usuario_id', user.auth_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
