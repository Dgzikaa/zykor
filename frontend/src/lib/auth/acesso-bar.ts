/**
 * Guard "usuário autenticado E com acesso a ESTE bar" para rotas de API.
 *
 * Existe porque as rotas do agente traziam um guard próprio, escrito no modelo antigo, que
 * estava quebrado de duas formas ao mesmo tempo (descoberto em 03/08/2026):
 *
 *  1. `supabase.auth.getSession()` com o client de `createServerClient()` — que é service role
 *     e `persistSession: false` — retorna SEMPRE null. O app autentica por JWT próprio (header
 *     Bearer / cookie auth_token, ver `middleware/auth`), não por sessão do Supabase. Resultado:
 *     401 "Não autenticado" para todo mundo, sempre.
 *  2. o acesso ao bar era conferido em `usuarios_bar`, tabela que NÃO EXISTE (é resquício do
 *     login antigo). Toda consulta voltava PGRST205 → `acesso` null → 403.
 *
 * Aqui o guard usa o caminho canônico: `authenticateUser` + `usuarios.temAcessoAoBar`
 * (auth_custom.usuarios_bares). Devolve a resposta de erro pronta, ou null quando pode seguir.
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { repos } from '@/lib/repositories';

export async function autenticarEValidarBar(
  request: NextRequest,
  barId: string | number | null | undefined,
): Promise<NextResponse | null> {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const bar = Number(barId);
  if (!Number.isFinite(bar)) {
    return NextResponse.json({ error: 'bar_id inválido' }, { status: 400 });
  }

  // Admin enxerga todos os bares — mesma regra dos outros guards do projeto.
  if (user.role === 'admin') return null;

  const { usuarios } = await repos();
  const temAcesso = await usuarios.temAcessoAoBar(user.auth_id, bar);
  if (!temAcesso) return permissionErrorResponse('Sem acesso a este bar');

  return null;
}
