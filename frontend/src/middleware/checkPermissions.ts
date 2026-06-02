/**
 * Middleware de verificação de permissões por módulo
 * 
 * Estrutura de roles:
 * - admin: Acesso total
 * - producao: Apenas produção e insumos
 * - operacional: Operações gerais
 * - visualizador: Apenas visualização
 */

export type UserRole = 'admin' | 'producao' | 'operacional' | 'visualizador';

export interface ModuloPermissao {
  leitura: boolean;
  escrita: boolean;
  exclusao: boolean;
}

export interface PermissoesModulo {
  producao: ModuloPermissao;
  insumos: ModuloPermissao;
  receitas: ModuloPermissao;
  relatorios: ModuloPermissao;
  configuracoes: ModuloPermissao;
  usuarios: ModuloPermissao;
  financeiro: ModuloPermissao;
}

/**
 * Define as permissões padrão por role
 */
export const PERMISSOES_PADRAO: Record<UserRole, Partial<PermissoesModulo>> = {
  admin: {
    producao: { leitura: true, escrita: true, exclusao: true },
    insumos: { leitura: true, escrita: true, exclusao: true },
    receitas: { leitura: true, escrita: true, exclusao: true },
    relatorios: { leitura: true, escrita: true, exclusao: true },
    configuracoes: { leitura: true, escrita: true, exclusao: true },
    usuarios: { leitura: true, escrita: true, exclusao: true },
    financeiro: { leitura: true, escrita: true, exclusao: true },
  },
  producao: {
    producao: { leitura: true, escrita: true, exclusao: false },
    insumos: { leitura: true, escrita: true, exclusao: false },
    receitas: { leitura: true, escrita: false, exclusao: false },
    relatorios: { leitura: true, escrita: false, exclusao: false },
    configuracoes: { leitura: false, escrita: false, exclusao: false },
    usuarios: { leitura: false, escrita: false, exclusao: false },
    financeiro: { leitura: false, escrita: false, exclusao: false },
  },
  operacional: {
    producao: { leitura: true, escrita: true, exclusao: false },
    insumos: { leitura: true, escrita: true, exclusao: false },
    receitas: { leitura: true, escrita: true, exclusao: false },
    relatorios: { leitura: true, escrita: false, exclusao: false },
    configuracoes: { leitura: true, escrita: false, exclusao: false },
    usuarios: { leitura: false, escrita: false, exclusao: false },
    financeiro: { leitura: true, escrita: false, exclusao: false },
  },
  visualizador: {
    producao: { leitura: true, escrita: false, exclusao: false },
    insumos: { leitura: true, escrita: false, exclusao: false },
    receitas: { leitura: true, escrita: false, exclusao: false },
    relatorios: { leitura: true, escrita: false, exclusao: false },
    configuracoes: { leitura: false, escrita: false, exclusao: false },
    usuarios: { leitura: false, escrita: false, exclusao: false },
    financeiro: { leitura: false, escrita: false, exclusao: false },
  },
};

/**
 * Verifica se o usuário tem permissão para acessar um módulo
 */
export function temPermissao(
  userRole: UserRole,
  modulo: keyof PermissoesModulo,
  acao: keyof ModuloPermissao,
  modulosPermitidos?: Partial<PermissoesModulo>
): boolean {
  // Admin sempre tem acesso
  if (userRole === 'admin') return true;

  // Verificar permissões customizadas primeiro
  if (modulosPermitidos && modulosPermitidos[modulo]) {
    return modulosPermitidos[modulo]![acao] || false;
  }

  // Usar permissões padrão
  const permissoesPadrao = PERMISSOES_PADRAO[userRole];
  return permissoesPadrao[modulo]?.[acao] || false;
}

/**
 * Retorna as rotas permitidas baseado no role
 */
export function getRotasPermitidas(userRole: UserRole): string[] {
  if (userRole === 'admin') {
    return ['*']; // Acesso total
  }

  const rotas: string[] = ['/home', '/usuarios/minha-conta', '/minha-conta'];

  if (userRole === 'producao') {
    return [
      ...rotas,
      '/ferramentas/producao-insumos',
      '/ferramentas/terminal',
      '/relatorios/desempenho',
    ];
  }

  if (userRole === 'operacional') {
    return [
      ...rotas,
      '/operacoes',
      '/ferramentas/producao-insumos',
      '/ferramentas/terminal',
      '/relatorios',
    ];
  }

  if (userRole === 'visualizador') {
    return [
      ...rotas,
      '/relatorios',
      '/dashboard',
    ];
  }

  return rotas;
}

/**
 * Verifica se o usuário pode acessar uma rota específica
 */
export function podeAcessarRota(userRole: UserRole, rota: string): boolean {
  const rotasPermitidas = getRotasPermitidas(userRole);
  
  if (rotasPermitidas.includes('*')) return true;
  
  return rotasPermitidas.some(rotaPermitida => 
    rota.startsWith(rotaPermitida)
  );
}

/**
 * Hook para usar em componentes React
 */
export function usePermissoes(userRole: UserRole, modulosPermitidos?: Partial<PermissoesModulo>) {
  return {
    temPermissao: (modulo: keyof PermissoesModulo, acao: keyof ModuloPermissao) =>
      temPermissao(userRole, modulo, acao, modulosPermitidos),
    podeAcessarRota: (rota: string) => podeAcessarRota(userRole, rota),
    rotasPermitidas: getRotasPermitidas(userRole),
  };
}

