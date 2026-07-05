import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { repos } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

// GET — buscar por id (apenas do próprio usuário / bar)
export const GET = withAuth(async ({ user }, ctx) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  const { id } = await ctx!.params;

  const { notificacoes } = await repos();
  const notif = await notificacoes.findById(id);
  if (!notif || notif.bar_id !== user.bar_id) throw new NotFoundError('Notificacao', id);
  if (notif.usuario_id !== user.auth_id && user.role !== 'admin') {
    throw new ForbiddenError('Sem permissao para acessar esta notificacao');
  }
  return success(notif);
});

// PUT — marcar como lida
const AtualizarSchema = z.object({ lida: z.boolean().optional() });

export const PUT = withAuth(async ({ user, request }, ctx) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  const { id } = await ctx!.params;
  const body = AtualizarSchema.parse(await request.json());

  const { notificacoes } = await repos();
  const notif = await notificacoes.findById(id);
  if (!notif || notif.bar_id !== user.bar_id) throw new NotFoundError('Notificacao', id);
  if (notif.usuario_id !== user.auth_id) {
    throw new ForbiddenError('Sem permissao para atualizar esta notificacao');
  }

  if (body.lida) await notificacoes.marcarLida(id, user.auth_id);
  return success({ id, lida: body.lida ?? notif.lida });
});

// DELETE — excluir (só o dono)
export const DELETE = withAuth(async ({ user }, ctx) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  const { id } = await ctx!.params;

  const { notificacoes } = await repos();
  const notif = await notificacoes.findById(id);
  if (!notif || notif.bar_id !== user.bar_id) throw new NotFoundError('Notificacao', id);
  if (notif.usuario_id !== user.auth_id) {
    throw new ForbiddenError('Sem permissao para excluir esta notificacao');
  }

  await notificacoes.excluir(id, user.auth_id);
  return success({ deleted: true });
});
