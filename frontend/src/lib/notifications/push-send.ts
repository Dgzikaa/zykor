/**
 * Envio de Web Push reutilizável (servidor → celular).
 *
 * Extraído de /api/push/send pra ser chamado direto pelo dispatcher de
 * notificações sem HTTP intermediário. Best-effort: nunca lança — só reporta
 * quantos foram e quantas inscrições mortas foram podadas.
 */
import webpush from 'web-push';
import { getAdminClient } from '@/lib/supabase-admin';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

type SubRow = { endpoint: string; p256dh: string; auth: string };

/**
 * Envia push para todas as inscrições ativas dos usuários dados (por auth_id).
 * Poda inscrições mortas (404/410 → ativo=false).
 */
export async function enviarPushParaUsuarios(
  usuarioIds: string[],
  payload: PushPayload
): Promise<{ enviados: number; removidas: number }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || usuarioIds.length === 0) {
    return { enviados: 0, removidas: 0 };
  }

  const supabase = await getAdminClient();
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('usuario_id', usuarioIds)
    .eq('ativo', true);

  if (error || !subs || subs.length === 0) return { enviados: 0, removidas: 0 };

  webpush.setVapidDetails('mailto:rodrigo@grupomenosemais.com.br', VAPID_PUBLIC, VAPID_PRIVATE);
  const body = JSON.stringify({
    title: payload.title || 'Zykor',
    body: payload.body || '',
    url: payload.url || '/',
    icon: payload.icon || '/logos/logo_zykor.png',
    tag: payload.tag,
    requireInteraction: !!payload.requireInteraction,
  });

  let enviados = 0;
  const mortas: string[] = [];
  await Promise.all(
    (subs as SubRow[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        enviados++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) mortas.push(s.endpoint);
      }
    })
  );

  if (mortas.length) {
    await supabase.from('push_subscriptions').update({ ativo: false }).in('endpoint', mortas);
  }
  return { enviados, removidas: mortas.length };
}
