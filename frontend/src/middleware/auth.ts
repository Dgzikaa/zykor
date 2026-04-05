import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { safeErrorLog } from '@/lib/logger';
import { validateToken } from '@/lib/auth/jwt';

// 🔇 Controle de logs verbose - defina como true para debug
const VERBOSE_AUTH_LOGS = true;

// Tipos para o usuário autenticado
export interface AuthenticatedUser {
  id: number;
  auth_id: string;
  email: string;
  nome: string;
  role: 'admin' | 'financeiro' | 'funcionario';
  setor?: string;
  bar_id?: number;
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

// Tipos para permissões
export interface PermissionCheck {
  module: string;
  action: 'read' | 'write' | 'delete' | 'admin';
  resource?: string;
}

/**
 * Middleware de autenticação para APIs
 * Valida o usuário logado via JWT ou cookie
 * 
 * PRIORIDADE SEGURA:
 * 1. Authorization Bearer token (JWT validado)
 * 2. Cookie sgb_user (dados validados no banco)
 * 
 * NOTA: x-selected-bar-id pode ser usado apenas para override de bar_id
 * após autenticação bem-sucedida, com validação de acesso.
 */
export async function authenticateUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    let authenticatedUser: AuthenticatedUser | null = null;

    // PRIORIDADE 1: Header Authorization Bearer (JWT)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const decoded = validateToken(token);
      
      if (decoded && decoded.email && decoded.user_id) {
        // Validar se o usuário ainda existe e está ativo
        const supabase = await getAdminClient();
        const { data: usuario, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', decoded.user_id)
          .eq('ativo', true)
          .single();

        if (!error && usuario) {
          if (VERBOSE_AUTH_LOGS) {
            console.log('✅ Usuário autenticado via JWT:', usuario.nome);
          }
          authenticatedUser = usuario as AuthenticatedUser;
        }
      }
    }

    // PRIORIDADE 2: Cookie sgb_user (fallback)
    // TODO(rodrigo/2026-05): Remover sgb_user quando migração estiver completa
    if (!authenticatedUser) {
      const userCookie = request.cookies.get('sgb_user')?.value;
      
      if (userCookie) {
        try {
          const userData = JSON.parse(decodeURIComponent(userCookie));

          if (userData && userData.email && userData.id) {
            // Validar se o usuário ainda existe e está ativo
            const supabase = await getAdminClient();
            const { data: usuario, error } = await supabase
              .from('usuarios')
              .select('*')
              .eq('id', userData.id)
              .eq('ativo', true)
              .single();

            if (!error && usuario) {
              if (VERBOSE_AUTH_LOGS) {
                console.log('✅ Usuário autenticado via cookie:', usuario.nome);
              }
              authenticatedUser = usuario as AuthenticatedUser;
            }
          }
        } catch {
          // Cookie inválido, ignora
        }
      }
    }

    // Se não autenticou por nenhum método, retorna null
    if (!authenticatedUser) {
      return null;
    }

    // Buscar bar_id do usuário (usuarios não tem bar_id — vem de usuarios_bares)
    const supabase = await getAdminClient();

    if (!authenticatedUser.bar_id) {
      const { data: userBars } = await supabase
        .from('usuarios_bares')
        .select('bar_id')
        .eq('usuario_id', authenticatedUser.auth_id)
        .limit(1);

      if (userBars && userBars.length > 0) {
        authenticatedUser = { ...authenticatedUser, bar_id: userBars[0].bar_id };
      }
    }

    // OVERRIDE SEGURO: x-selected-bar-id para multi-bar
    const selectedBarId = request.headers.get('x-selected-bar-id');
    if (selectedBarId) {
      const barId = parseInt(selectedBarId, 10);
      if (!isNaN(barId) && barId !== authenticatedUser.bar_id) {
        const { data: acesso } = await supabase
          .from('usuarios_bares')
          .select('bar_id')
          .eq('usuario_id', authenticatedUser.auth_id)
          .eq('bar_id', barId)
          .single();

        if (acesso) {
          if (VERBOSE_AUTH_LOGS) {
            console.log(`🔄 Bar override para ${barId} (usuário ${authenticatedUser.nome})`);
          }
          authenticatedUser = { ...authenticatedUser, bar_id: barId };
        } else {
          console.warn(`⚠️ Tentativa de acesso não autorizado ao bar ${barId} por ${authenticatedUser.email}`);
        }
      }
    }

    return authenticatedUser;
  } catch (error) {
    safeErrorLog('autenticação', error);
    return null;
  }
}

/**
 * Verificar permissões do usuário
 */
export function checkPermission(
  user: AuthenticatedUser,
  permission: PermissionCheck
): boolean {
  // Admin pode tudo
  if ((user.role as string) === 'admin') {
    return true;
  }

  // Verificar permissões específicas do módulo
  const modulePermissions = user.modulos_permitidos || [];

  // Função helper para verificar permissão
  const hasModulePermission = (perm: string): boolean => {
    // Se modulos_permitidos é um array
    if (Array.isArray(modulePermissions)) {
      return modulePermissions.includes(perm);
    }
    // Se modulos_permitidos é um objeto
    if (typeof modulePermissions === 'object') {
      return modulePermissions[perm] === true;
    }
    return false;
  };

  switch (permission.module) {
    case 'checklists':
      switch (permission.action) {
        case 'read':
          // Todos podem ler checklists
          return (
            hasModulePermission('checklists') ||
            hasModulePermission('checklists_read') ||
            user.role === 'financeiro'
          );

        case 'write':
          // Financeiro e admin podem criar/editar
          return (
            user.role === 'financeiro' ||
            hasModulePermission('checklists_write') ||
            hasModulePermission('checklists_admin')
          );

        case 'delete':
          // Só admin pode deletar
          return (
            (user.role as string) === 'admin' ||
            hasModulePermission('checklists_admin')
          );

        case 'admin':
          // Só admin tem acesso total
          return (user.role as string) === 'admin';

        default:
          return false;
      }

    default:
      return false;
  }
}

/**
 * Resposta de erro de autenticação
 */
export function authErrorResponse(
  message: string = 'Não autorizado',
  status: number = 401
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'AUTH_ERROR',
    },
    { status }
  );
}

/**
 * Resposta de erro de permissão
 */
export function permissionErrorResponse(
  message: string = 'Permissão negada',
  status: number = 403
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'PERMISSION_DENIED',
    },
    { status }
  );
}

// Lista de rotas que requerem autenticação
export const PROTECTED_ROUTES = [
  '/api/configuracoes',
  '/api/configuracoes/dashboard',
  // Rotas NIBO removidas (substituído pelo Conta Azul)
];

// Lista de rotas públicas (podem ser acessadas sem auth)
export const PUBLIC_ROUTES = [
  '/api/config', // Temporariamente público até implementar auth adequada
  '/api/relatorios', // Dados agregados, sem informações sensíveis
];

export function requiresAuth(pathname: string): boolean {
  // Verificar se é uma rota protegida
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

export function isPublicRoute(pathname: string): boolean {
  // Verificar se é uma rota explicitamente pública
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}
