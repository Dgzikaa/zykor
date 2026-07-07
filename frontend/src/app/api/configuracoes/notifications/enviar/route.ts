import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { ForbiddenError } from '@/lib/errors';
import { dispatchNotification } from '@/lib/notifications/dispatch';

export const dynamic = 'force-dynamic';

// POST — broadcast manual (recado da equipe). Admin envia um aviso pra
// cargos e/ou usuários específicos, escolhendo os canais.
const EnviarSchema = z
  .object({
    titulo: z.string().min(1).max(120),
    mensagem: z.string().min(1).max(1000),
    url: z.string().max(500).optional(),
    severidade: z.enum(['info', 'sucesso', 'alerta', 'critico']).default('info'),
    roles: z.array(z.enum(['admin', 'financeiro', 'funcionario'])).default([]),
    user_ids: z.array(z.string().uuid()).default([]),
    canais: z.array(z.enum(['in_app', 'push', 'whatsapp'])).min(1).default(['in_app']),
  })
  .refine((d) => d.roles.length > 0 || d.user_ids.length > 0, {
    message: 'Escolha ao menos um cargo ou usuário',
    path: ['roles'],
  });

export const POST = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (user.role !== 'admin') throw new ForbiddenError('Apenas admin envia avisos');

  const body = EnviarSchema.parse(await request.json());

  const canais = body.canais;
  if (canais.length === 0) return fail('Escolha ao menos um canal', 400);

  const resultado = await dispatchNotification({
    barId: user.bar_id,
    eventKey: 'aviso_manual',
    titulo: body.titulo,
    mensagem: body.mensagem,
    url: body.url,
    severidade: body.severidade,
    dados: { origem: 'broadcast_manual', enviado_por: user.auth_id },
    destinatarios: { roles: body.roles, authIds: body.user_ids },
    canais,
  });

  return success(resultado, { status: 201 });
});
