import { userHasAnyModule, userCan, type PermAction } from '@/lib/permissions/resolver';

// Módulos que dão acesso ao financeiro/agendamentos (envio de PIX, baixa no CA etc.).
const MODULOS_FINANCEIRO = [
  'financeiro',
  'financeiro_ferramentas',
  'ferramentas_agendamento',
  'financeiro_agendamento',
];

/**
 * Ids dos módulos por FERRAMENTA (categoria "Ferramentas Financeiro"; = gerarIdModulo).
 * Cada ferramenta gateia sua própria operação de API — ver `podeFerramentaFinanceira`.
 */
export const FERRAMENTA_FINANCEIRA = {
  agendamentos: 'ferramentas financeiro_agendamentos',
  pedidos: 'ferramentas financeiro_pedidos_de_pagamento',
  beneficiarios: 'ferramentas financeiro_beneficiarios',
  conciliacao: 'ferramentas financeiro_conciliacao',
  receitas: 'ferramentas financeiro_receitas_ca',
  despesas: 'ferramentas financeiro_despesas_ca',
  historico: 'ferramentas financeiro_historico_ca',
  notas: 'ferramentas financeiro_notas_fiscais',
  categorias: 'ferramentas financeiro_categorias',
  fluxo: 'ferramentas financeiro_fluxo_de_caixa',
  consultas: 'ferramentas financeiro_consultas_ca',
} as const;

/**
 * Pode operar UMA ferramenta financeira específica (ação padrão: 'inserir').
 * Retrocompat total: admin/role financeiro passam; `userCan` já honra 'todos' e o generic do
 * grupo (`financeiro_ferramentas`/`financeiro` concedem todas as ferramentas). Grant granular
 * (`<modulo>:<acao>`) libera só aquela ferramenta+ação.
 */
export function podeFerramentaFinanceira(user: any, moduleId: string, action: PermAction = 'inserir'): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'financeiro') return true;
  return userCan(user.modulos_permitidos, moduleId, action);
}

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
