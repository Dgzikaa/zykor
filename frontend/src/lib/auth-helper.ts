import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

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
  try {
    let userData: string | null = null;
    let selectedBarId: number | null = null;

    if (request) {
      // Pegar bar_id do header x-selected-bar-id
      const barIdHeader = request.headers.get('x-selected-bar-id');
      if (barIdHeader) {
        selectedBarId = parseInt(barIdHeader, 10) || null;
      }

      // Tentar pegar dados do usuário do cookie
      // TODO(rodrigo/2026-05): Remover sgb_user quando migração estiver completa
      const cookieValue = request.cookies.get('sgb_user')?.value;
      if (cookieValue) {
        userData = cookieValue;
      }
    } else {
      // Usar o headers() do Next.js
      const headersList = await headers();
      const barIdHeader = headersList.get('x-selected-bar-id');
      if (barIdHeader) {
        selectedBarId = parseInt(barIdHeader, 10) || null;
      }
    }

    if (!userData) {
      return null;
    }

    // Decodificar URL encoding antes de fazer JSON.parse
    const decodedUserData = decodeURIComponent(userData);
    const parsedUser = JSON.parse(decodedUserData);

    if (!parsedUser || !parsedUser.email || !parsedUser.id) {
      return null;
    }

    // Normalizar dados para garantir compatibilidade
    // Usar bar_id do header x-selected-bar-id se disponível, senão do cookie
    const user: UserAuth = {
      id: parsedUser.id,
      user_id: parsedUser.user_id || parsedUser.id.toString(),
      email: parsedUser.email,
      nome: parsedUser.nome || parsedUser.email,
      role: parsedUser.role || parsedUser.permissao || 'funcionario',
      bar_id: selectedBarId || parsedUser.bar_id,
      permissao: parsedUser.role || parsedUser.permissao || 'funcionario',
      modulos_permitidos: parsedUser.modulos_permitidos || [],
      ativo: parsedUser.ativo !== false,
    };

    return user;
  } catch (error) {
    console.error('❌ Erro ao processar autenticação:', error);
    return null;
  }
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
