import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { ForbiddenError } from '@/lib/errors';
import { repos } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

// GET — histórico de TODAS as notificações disparadas no bar (visão admin).
const FiltrosSchema = z.object({
  categoria: z.string().optional(),
  event_key: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (user.role !== 'admin') throw new ForbiddenError('Apenas admin vê o histórico do bar');

  const url = new URL(request.url);
  const p = FiltrosSchema.parse(Object.fromEntries(url.searchParams));
  const { notificacoes } = await repos();

  const { data, total } = await notificacoes.listarDoBar({
    barId: user.bar_id,
    categoria: p.categoria,
    eventKey: p.event_key,
    page: p.page,
    limit: p.limit,
  });

  return success({
    notificacoes: data,
    paginacao: {
      page: p.page,
      limit: p.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / p.limit)),
    },
  });
});
