import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { repos } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

// =====================================================
// GET — buscar notificacao por id
// =====================================================
export const GET = withAuth(async ({ user }, ctx) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  const { id } = await ctx!.params;

  const { notificacoes } = await repos();
  const notif = await notificacoes.findById(id);

  if (!notif) throw new NotFoundError('Notificacao', id);

  const n = notif as { usuario_id?: string; role_alvo?: string; bar_id?: string };
  if (String(n.bar_id) !== String(user.bar_id)) {
    throw new NotFoundError('Notificacao', id);
  }

  const podeVer =
    n.usuario_id === user.auth_id ||
    n.role_alvo === user.role ||
    user.role === 'admin';
  if (!podeVer) throw new ForbiddenError('Sem permissao para acessar esta notificacao');

  return success(notif);
});

// =====================================================
// PUT — atualizar (marcar como lida, etc)
// =====================================================
const AtualizarSchema = z.object({
  status: z.enum(['lida', 'descartada']).optional(),
  dados_extras: z.record(z.string(), z.unknown()).optional(),
});

export const PUT = withAuth(async ({ user, request }, ctx) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  const { id } = await ctx!.params;
  const body = AtualizarSchema.parse(await request.json());

  const { notificacoes } = await repos();
  const atual = await notificacoes.findById(id);
  if (!atual) throw new NotFoundError('Notificacao', id);

  const a = atual as {
    usuario_id?: string;
    role_alvo?: string;
    bar_id?: string;
    dados_extras?: Record<string, unknown>;
  };
  if (String(a.bar_id) !== String(user.bar_id)) throw new NotFoundError('Notificacao', id);

  const podeEditar =
    a.usuario_id === user.auth_id || a.role_alvo === user.role || user.role === 'admin';
  if (!podeEditar) throw new ForbiddenError('Sem permissao para atualizar esta notificacao');

  const patch: Record<string, unknown> = {};
  if (body.status) {
    patch.status = body.status;
    if (body.status === 'lida') patch.lida_em = new Date().toISOString();
  }
  if (body.dados_extras) {
    patch.dados_extras = { ...(a.dados_extras ?? {}), ...body.dados_extras };
  }

  const atualizada = await notificacoes.atualizar(id, patch);
  return success(atualizada);
});

// =====================================================
// DELETE — excluir notificacao
// =====================================================
export const DELETE = withAuth(async ({ user }, ctx) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  const { id } = await ctx!.params;

  const { notificacoes } = await repos();
  const notif = await notificacoes.findById(id);
  if (!notif) throw new NotFoundError('Notificacao', id);

  const n = notif as { usuario_id?: string; bar_id?: string };
  if (String(n.bar_id) !== String(user.bar_id)) throw new NotFoundError('Notificacao', id);

  const podeExcluir = user.role === 'admin' || n.usuario_id === user.auth_id;
  if (!podeExcluir) throw new ForbiddenError('Sem permissao para excluir esta notificacao');

  await notificacoes.excluir(id);
  return success({ deleted: true });
});

// =====================================================
// PATCH — acoes em massa (mark_all_read, clear_old)
// =====================================================
export const PATCH = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const { notificacoes } = await repos();

  if (action === 'mark_all_read') {
    const modulo = url.searchParams.get('modulo') ?? undefined;
    const count = await notificacoes.marcarTodasLidasParaUsuario({
      barId: String(user.bar_id),
      authId: user.auth_id,
      role: user.role,
      modulo,
    });
    return success({ count, message: `${count} notificacoes marcadas como lidas` });
  }

  return fail('Acao nao suportada', 400);
});
