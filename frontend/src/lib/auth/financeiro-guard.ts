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
  // `role === 'admin'` segue como bypass (é o único role que ainda significa algo). O
  // `role === 'financeiro'` FOI REMOVIDO em 03/08/2026: o acesso é RBAC por perfil, e a coluna
  // role ficou congelada no cadastro antigo — dava falso negativo (David, perfil "Financeiro"
  // completo, role 'funcionario') e falso positivo (quem manteve o role velho). Quem tem o perfil
  // Financeiro continua passando pelos MÓDULOS, que é o certo.
  if (user.role === 'admin') return true;
  return userCan(user.modulos_permitidos, moduleId, action);
}

/**
 * Pode operar PELO MENOS UMA das ferramentas listadas.
 *
 * Para rota compartilhada entre telas — mesma regra do `negarSeNaoPode` em
 * lib/permissions/guard.ts. Cadastrar fornecedor no CA, por exemplo, é feito tanto da tela de
 * Beneficiários quanto de dentro do Pedido de Pagamento; exigir só `beneficiarios` barrava
 * quem tinha acesso legítimo a Pedidos (caso da Ana Paula, 27/07/2026: a tela abria, o
 * cadastro voltava "Sem permissão nesta ferramenta financeira").
 *
 * Passe as ferramentas que a rota realmente serve — não use como atalho pra afrouxar guard.
 */
export function podeAlgumaFerramentaFinanceira(
  user: any,
  moduleIds: readonly string[],
  action: PermAction = 'inserir',
): boolean {
  return moduleIds.some(id => podeFerramentaFinanceira(user, id, action));
}

/**
 * Pode operar o financeiro/agendamentos?
 *
 * Antes as rotas exigiam `role === 'admin' || 'financeiro'`, o que BARRAVA funcionário
 * COM o módulo financeiro (ex.: David, role=funcionario, módulos financeiro+agendamento):
 * a lista de credenciais Inter, o envio de PIX e a baixa no CA voltavam 403 e a seção
 * "API Inter" nem aparecia. O acesso é por MÓDULO (RBAC por perfil).
 *
 * CUIDADO ao usar como guard de ESCRITA sensível: MODULOS_FINANCEIRO é AMPLO. Medido com o
 * resolver em 03/08/2026, `podeFinanceiro` passa para 8 dos 9 perfis — inclusive **Sócio
 * (contas de agências)** e Operação, via generics (`financeiro_relatorios` concede o genérico
 * `financeiro`). Para ação restrita, use `podeFerramentaFinanceira` com a ferramenta específica
 * (ex.: conciliação = só Admin, Financeiro e Liderança).
 */
export function podeFinanceiro(user: any): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true; // `role === 'financeiro'` removido (RBAC por perfil)
  return userHasAnyModule(user.modulos_permitidos, MODULOS_FINANCEIRO);
}
