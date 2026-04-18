import { withAuth } from '@/lib/http/with-auth';
import { success } from '@/lib/http/responses';
import { listarBaresDoUsuario } from '@/lib/services/auth/listar-bares-do-usuario';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async ({ user }) => {
  const result = await listarBaresDoUsuario(user.email);
  return success(result);
});
