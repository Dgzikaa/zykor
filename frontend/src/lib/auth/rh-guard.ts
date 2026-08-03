import { userHasAnyModule } from '@/lib/permissions/resolver';

// Módulos que dão acesso às operações de RH (ex.: sync do ponto Tangerino).
// Ponto é a integração-alvo, mas quem tem qualquer módulo de RH opera as ferramentas de RH.
const MODULOS_RH = [
  'rh_ponto',
  'rh_funcionarios',
  'rh_escala',
];

/**
 * Pode operar as ferramentas de RH (sync/cadastro de integrações como o Tangerino)?
 *
 * Antes as rotas exigiam `role === 'admin' || 'rh' || 'financeiro'`, o que barrava
 * funcionário COM o módulo de RH. Agora o acesso é por MÓDULO — quem tem o módulo passa —
 * mantendo os roles legados (admin/rh/financeiro) por compatibilidade (aditivo, sem regressão).
 * Admin sempre passa.
 */
export function podeRH(user: any): boolean {
  if (!user) return false;
  // Só `admin` segue como bypass. Os roles 'rh' e 'financeiro' foram REMOVIDOS em 03/08/2026:
  // o acesso é RBAC por perfil e a coluna role é resquício. Medido com o resolver, os módulos
  // de RH resolvem para Admin, Administrativo e Liderança — o perfil Financeiro NÃO tem RH, então
  // quem só tinha acesso pelo role antigo (Katrinny, Pandolfi) deixa de ter, como manda o perfil.
  if (user.role === 'admin') return true;
  return userHasAnyModule(user.modulos_permitidos, MODULOS_RH);
}
