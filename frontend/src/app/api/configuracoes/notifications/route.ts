import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { repos } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

// =====================================================
// GET — notificações DO USUÁRIO logado (inbox) + contadores
// =====================================================
const FiltrosSchema = z.object({
  apenas_nao_lidas: z.union([z.literal('true'), z.literal('false')]).optional(),
  categoria: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);

  const url = new URL(request.url);
  const p = FiltrosSchema.parse(Object.fromEntries(url.searchParams));
  const { notificacoes } = await repos();

  const [{ data, total }, naoLidas, stats] = await Promise.all([
    notificacoes.listarDoUsuario({
      barId: user.bar_id,
      usuarioId: user.auth_id,
      apenasNaoLidas: p.apenas_nao_lidas === 'true',
      categoria: p.categoria,
      page: p.page,
      limit: p.limit,
    }),
    notificacoes.contarNaoLidas(user.bar_id, user.auth_id),
    notificacoes.estatisticasUsuario(user.bar_id, user.auth_id, 7),
  ]);

  return success({
    notificacoes: data,
    nao_lidas: naoLidas,
    estatisticas: stats,
    paginacao: {
      page: p.page,
      limit: p.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / p.limit)),
    },
  });
});

// =====================================================
// PATCH — ações em massa (?action=mark_all_read)
// =====================================================
export const PATCH = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const { notificacoes } = await repos();

  if (action === 'mark_all_read') {
    const count = await notificacoes.marcarTodasLidas(user.bar_id, user.auth_id);
    return success({ count });
  }

  return fail('Acao nao suportada', 400);
});
