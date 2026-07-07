import { withAuth } from '@/lib/http/with-auth';
import { hasPermission } from '@/lib/auth/get-user';
import { fail, success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET — lista insumos ativos do bar (codigo, nome) p/ o seletor de ALVO no
 * construtor de alertas (sinal "estoque de UM insumo"). Admin.
 */
export const GET = withAuth(async ({ user }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (!hasPermission(user, 'configuracoes')) return fail('Sem permissão', 403);
  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('operations')
    .from('insumos')
    .select('codigo, nome')
    .eq('bar_id', user.bar_id)
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return fail(error.message, 500);
  return success({ insumos: data ?? [] });
});
