/**
 * Rotas públicas — acessíveis SEM sessão autenticada.
 *
 * Fonte ÚNICA da verdade para os guards globais (SessionManager, PermissionGuard)
 * e para a verificação de sessão (session-manager.ts). Mantida centralizada porque
 * listas duplicadas divergiam e quebravam o PRIMEIRO ACESSO: a página de redefinição
 * de senha vive em /usuarios/redefinir-senha (sob a árvore protegida), mas o usuário
 * AINDA não tem sessão no 1º acesso → o guard jogava ele de volta pro /login em loop.
 */
export const PUBLIC_ROUTES = [
  '/login',
  '/auth',                      // staff-login, success, callbacks
  '/usuarios/redefinir-senha',  // 1º acesso / recuperação — usuário sem sessão
] as const;

/** True se a rota é pública (não exige sessão). Casa exato ou sub-rota (route + '/'). */
export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
}
