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

// método HTTP → ação CRUD
const METODO_ACAO: Record<string, PermAction> = { POST: 'inserir', PUT: 'editar', PATCH: 'editar', DELETE: 'excluir' };

/**
 * MAPA CENTRAL rota de API → páginas (do menu) que a servem. O guard confere a permissão do(s)
 * módulo(s) dessas páginas. Rota compartilhada = várias páginas (libera se puder em qualquer uma).
 * Prefixo mais específico vence (ordena por comprimento). Rota não mapeada = não bloqueia (fail-open,
 * expandir o mapa por lote). Manter aqui é o "único lugar" — nada de permissão espalhada.
 */
const ROTA_MODULOS: Array<{ prefix: string; paths: string[] }> = [
  // --- Operacional ---
  { prefix: '/api/operacional/producoes/ficha', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/fichas/grupo', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/fichas/insumo-uso', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/produtos', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/producoes/execucao', paths: ['/operacional/producoes'] },
  { prefix: '/api/operacional/producoes/alimentacao', paths: ['/operacional/producoes'] },
  // /api/operacional/pessoas-responsaveis é admin-only (checa role na própria rota) — fora do mapa de propósito
  { prefix: '/api/operacional/producoes', paths: ['/operacional/fichas-tecnicas', '/operacional/producoes'] },
  { prefix: '/api/operacional/insumos', paths: ['/operacional/insumos'] },
  { prefix: '/api/operacional/desvios', paths: ['/operacional/desvios'] },
  { prefix: '/api/operacional/cmv-teorico', paths: ['/operacional/cmv-teorico'] },
  { prefix: '/api/operacional/plano-producao', paths: ['/operacional/plano-producao'] },
  { prefix: '/api/operacional/plano-compras', paths: ['/operacional/plano-compras'] },
  { prefix: '/api/operacional/estoque-cadastro', paths: ['/operacional/estoque-historico'] },
  { prefix: '/api/operacional/estoque-historico', paths: ['/operacional/estoque-historico'] },
];

/**
 * Guard por rota (usa o MAPA + o método HTTP). Chamar nas rotas de escrita DEPOIS do
 * authenticateUser: `const nega = negarPorRota(user, request); if (nega) return nega;`
 * GET/HEAD e rotas não mapeadas passam (leitura + fail-open).
 */
export function negarPorRota(user: AuthenticatedUser | null, request: Request): NextResponse | null {
  const action = METODO_ACAO[request.method];
  if (!action) return null; // não é escrita
  const pathname = new URL(request.url).pathname;
  const match = ROTA_MODULOS
    .filter(m => pathname === m.prefix || pathname.startsWith(m.prefix + '/') || pathname.startsWith(m.prefix + '?'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!match) return null; // rota não mapeada → não bloqueia (expandir o mapa)
  return negarSeNaoPode(user, match.paths, action);
}
