import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { ForbiddenError } from '@/lib/errors';
import { repos } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

// GET — usuários ativos do bar (pra seletor de destinatários nas regras/broadcast)
export const GET = withAuth(async ({ user }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (user.role !== 'admin') throw new ForbiddenError('Apenas admin');

  const { usuarios } = await repos();
  const lista = await usuarios.listarDoBar(user.bar_id);
  return success({ usuarios: lista });
});
