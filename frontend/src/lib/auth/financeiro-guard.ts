import { userHasAnyModule } from '@/lib/permissions/resolver';

// Módulos que dão acesso ao financeiro/agendamentos (envio de PIX, baixa no CA etc.).
const MODULOS_FINANCEIRO = [
  'financeiro',
  'financeiro_ferramentas',
  'ferramentas_agendamento',
  'financeiro_agendamento',
];

/**
 * Pode operar o financeiro/agendamentos?
 *
 * Antes as rotas exigiam `role === 'admin' || 'financeiro'`, o que BARRAVA funcionário
 * COM o módulo financeiro (ex.: David, role=funcionario, módulos financeiro+agendamento):
 * a lista de credenciais Inter, o envio de PIX e a baixa no CA voltavam 403 e a seção
 * "API Inter" nem aparecia. Como o acesso agora é por MÓDULO, liberamos quem tem o
 * módulo — mantendo os roles legados (admin/financeiro) por compatibilidade.
 */
export function podeFinanceiro(user: any): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'financeiro') return true;
  return userHasAnyModule(user.modulos_permitidos, MODULOS_FINANCEIRO);
}
