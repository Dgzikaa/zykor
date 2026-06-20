'use client';

/**
 * Web Push (servidor -> celular, mesmo com app fechado).
 * Registra o /sw.js, pede permissão, inscreve com a chave VAPID pública e
 * envia a subscription pro backend (/api/push/subscribe).
 * iOS: só funciona com o PWA instalado (Adicionar à Tela de Início).
 */
import { api } from '@/lib/api-client';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSuportado(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushPermissao(): NotificationPermission | 'indisponivel' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'indisponivel';
  return Notification.permission;
}

export async function pushJaInscrito(): Promise<boolean> {
  if (!pushSuportado()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

export async function ativarPush(barId?: number): Promise<{ ok: boolean; error?: string }> {
  if (!pushSuportado()) return { ok: false, error: 'Seu navegador não suporta notificações push.' };
  if (!VAPID_PUBLIC) return { ok: false, error: 'Push não configurado no servidor (VAPID ausente).' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, error: 'Permissão de notificação negada.' };

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC).buffer as ArrayBuffer,
      });
    }
    const json: any = sub.toJSON();
    await api.post('/api/push/subscribe', {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      bar_id: barId ?? null,
      user_agent: navigator.userAgent,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao ativar push.' };
  }
}

export async function desativarPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha ao desativar.' };
  }
}
