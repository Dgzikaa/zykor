import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/push/send — envia Web Push.
 * Alvo: { to_self } (default), ou { usuario_id } / { bar_id } (admin/financeiro).
 * Conteúdo: { title, body, url?, icon?, tag?, requireInteraction? }
 * Limpa subscriptions mortas (404/410).
 */
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ success: false, error: 'VAPID não configurado no servidor' }, { status: 500 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }

  const ehAdmin = user.role === 'admin' || user.role === 'financeiro';
  const supabase = await getAdminClient();
  let q = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('ativo', true);

  if (body.usuario_id) {
    if (!ehAdmin) return permissionErrorResponse('Sem permissão para enviar pra outro usuário');
    q = q.eq('usuario_id', body.usuario_id);
  } else if (body.bar_id) {
    if (!ehAdmin) return permissionErrorResponse('Sem permissão para enviar pro bar');
    q = q.eq('bar_id', Number(body.bar_id));
  } else {
    q = q.eq('usuario_id', user.auth_id); // default: pra si mesmo (teste)
  }

  const { data: subs, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ success: true, enviados: 0, aviso: 'nenhuma inscrição ativa' });

  webpush.setVapidDetails('mailto:rodrigo@grupomenosemais.com.br', VAPID_PUBLIC, VAPID_PRIVATE);
  const payload = JSON.stringify({
    title: body.title || 'Zykor',
    body: body.body || '',
    url: body.url || '/',
    icon: body.icon || '/logos/logo_zykor.png',
    tag: body.tag,
    requireInteraction: !!body.requireInteraction,
  });

  let enviados = 0; const mortas: string[] = [];
  await Promise.all((subs as any[]).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      enviados++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) mortas.push(s.endpoint);
    }
  }));

  if (mortas.length) {
    await supabase.from('push_subscriptions').update({ ativo: false }).in('endpoint', mortas);
  }
  return NextResponse.json({ success: true, enviados, removidas: mortas.length });
}
