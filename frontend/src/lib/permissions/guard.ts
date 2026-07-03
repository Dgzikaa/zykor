import { NextResponse } from 'next/server';
import type { AuthenticatedUser } from '@/middleware/auth';
import { userCan, type PermAction } from './resolver';
import { getModuleIdForPath } from './modules';

/**
 * Guard de permissão por AÇÃO (ver/editar/inserir/excluir), server-side. Chamado nas rotas de
 * escrita DEPOIS do authenticateUser. Segurança real (não dá pra burlar pelo front).
 *
 * Regra das rotas COMPARTILHADAS: libera se o usuário puder a ação em PELO MENOS UM dos módulos
 * que a rota serve (passe os `paths` das telas que usam a rota). Assim nunca trava outra tela —
 * quem tem direito legítimo passa; quem é só-ver em tudo é bloqueado. Admin passa sempre.
 *
 * Retorna um NextResponse 403 quando NEGADO, ou null quando permitido:
 *   const nega = negarSeNaoPode(user, ['/operacional/fichas-tecnicas'], 'editar');
 *   if (nega) return nega;
 */
export function negarSeNaoPode(
  user: AuthenticatedUser | null,
  paths: string[],
  action: PermAction,
): NextResponse | null {
  if (!user) return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });
  if ((user.role as string) === 'admin') return null; // admin faz tudo

  const moduleIds = paths.map(getModuleIdForPath).filter((x): x is string => !!x);
  if (moduleIds.length === 0) return null; // rota não mapeada → não bloqueia (fail-open só p/ não-mapeadas)

  const pode = moduleIds.some(id => userCan(user.modulos_permitidos, id, action));
  if (!pode) {
    return NextResponse.json(
      { success: false, error: `Você não tem permissão para ${action} nesta área.`, code: 'PERMISSION_DENIED' },
      { status: 403 },
    );
  }
  return null;
}
