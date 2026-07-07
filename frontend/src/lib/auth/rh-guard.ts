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
  if (user.role === 'admin' || user.role === 'rh' || user.role === 'financeiro') return true;
  return userHasAnyModule(user.modulos_permitidos, MODULOS_RH);
}
