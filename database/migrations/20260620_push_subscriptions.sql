-- 2026-06-20 — Web Push (notificação no celular do usuário, de graça, sem WhatsApp).
-- Guarda as subscriptions Web Push por usuário/dispositivo. O envio usa a lib web-push
-- + chaves VAPID (env: NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY).
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL,                 -- = usuarios.auth_id
  bar_id        integer,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.push_subscriptions(usuario_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_push_sub_bar ON public.push_subscriptions(bar_id) WHERE ativo;
