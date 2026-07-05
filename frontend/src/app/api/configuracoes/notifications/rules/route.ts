import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { ForbiddenError } from '@/lib/errors';
import { repos } from '@/lib/repositories';
import {
  eventsByCategoria,
  isValidEventKey,
  CANAIS,
  getEvent,
} from '@/lib/notifications/catalog';

export const dynamic = 'force-dynamic';

// GET — catálogo (grupos) + regras atuais do bar (mapa por event_key)
export const GET = withAuth(async ({ user }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (user.role !== 'admin') throw new ForbiddenError('Apenas admin configura regras');

  const { notificationRules } = await repos();
  const regras = await notificationRules.listarDoBar(user.bar_id);
  const regrasPorEvento: Record<string, unknown> = {};
  for (const r of regras) regrasPorEvento[r.event_key] = r;

  return success({
    grupos: eventsByCategoria(),
    regras: regrasPorEvento,
    canais: CANAIS,
  });
});

// PUT — upsert regra de um evento
const RuleSchema = z.object({
  event_key: z.string().refine(isValidEventKey, 'Evento desconhecido'),
  ativo: z.boolean().default(true),
  target_roles: z.array(z.enum(['admin', 'financeiro', 'funcionario'])).default([]),
  target_user_ids: z.array(z.string().uuid()).default([]),
  canais: z.array(z.enum(['in_app', 'push', 'whatsapp'])).min(1),
});

export const PUT = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (user.role !== 'admin') throw new ForbiddenError('Apenas admin configura regras');

  const body = RuleSchema.parse(await request.json());

  // Só aceita canais que o evento suporta (evita ligar whatsapp num evento que não usa).
  const evento = getEvent(body.event_key);
  const canaisValidos = body.canais.filter((c) => evento?.canaisSuportados.includes(c));
  if (canaisValidos.length === 0) return fail('Nenhum canal válido para este evento', 400);

  const { notificationRules } = await repos();
  const regra = await notificationRules.upsert({
    barId: user.bar_id,
    eventKey: body.event_key,
    ativo: body.ativo,
    targetRoles: body.target_roles,
    targetUserIds: body.target_user_ids,
    canais: canaisValidos,
  });

  return success(regra);
});
