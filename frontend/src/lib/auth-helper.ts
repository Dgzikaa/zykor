import { NextRequest } from 'next/server';
import { authenticateUser } from '@/middleware/auth';

export interface UserAuth {
  id: number;
  user_id: string;
  email: string;
  nome: string;
  role: 'admin' | 'financeiro' | 'funcionario';
  bar_id: number;
  permissao: string; // Alias para role para compatibilidade
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

/**
 * Função para extrair dados de autenticação do usuário
 * Lê os dados reais do usuário do cookie (JWT) e o bar_id do header x-selected-bar-id
 */
export async function getUserAuth(
  request?: NextRequest
): Promise<UserAuth | null> {
  // Delega pro resolver seguro (token assinado: header Bearer ou cookie auth_token,
  // sempre revalidado no banco). Antes este helper confiava em role/bar_id lidos do
  // cookie sgb_user cru (não assinado) — forjável. Sem request não dá pra autenticar.
  if (!request) return null;

  const user = await authenticateUser(request);
  if (!user || !user.bar_id) return null;

  return {
    id: user.id,
    user_id: user.auth_id,
    email: user.email,
    nome: user.nome,
    role: user.role,
    bar_id: user.bar_id,
    permissao: user.role,
    modulos_permitidos: user.modulos_permitidos,
    ativo: user.ativo,
  };
}

/**
 * Verificar se o usuário tem uma permissão específica
 */
export function hasPermission(user: UserAuth, permission: string): boolean {
  // Admin sempre tem todas as permissões
  if (user.role === 'admin') {
    return true;
  }

  // Verificar permissões específicas
  const permissions = user.modulos_permitidos || [];
  
  // Se modulos_permitidos é um array
  if (Array.isArray(permissions)) {
    return permissions.includes(permission) || permissions.includes('admin');
  }
  
  // Se modulos_permitidos é um objeto
  if (typeof permissions === 'object') {
    return permissions[permission] === true || permissions['admin'] === true;
  }
  
  return false;
}

/**
 * Verificar se o usuário pode administrar o sistema
 */
export function isAdmin(user: UserAuth): boolean {
  return user.role === 'admin' || user.permissao === 'admin';
}

/**
 * Verificar se o usuário pode gerenciar dados financeiros
 */
export function canManageFinancial(user: UserAuth): boolean {
  return isAdmin(user) || user.role === 'financeiro';
}

/**
 * Middleware helper para autenticação de APIs
 */
export function createAuthResponse(error: string, status: number = 401) {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      code: 'AUTH_ERROR',
      help: 'Faça login em /login para acessar esta funcionalidade',
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
