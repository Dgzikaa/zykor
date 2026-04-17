/**
 * Helper unificado para autenticação em API routes
 * 
 * HIERARQUIA DE AUTENTICAÇÃO:
 * 1. JWT via cookie httpOnly `auth_token` (PRIMÁRIO)
 * 2. Header `x-selected-bar-id` para multi-tenancy
 * 3. Fallback: cookie legado `sgb_user` (DEPRECADO - será removido)
 */

import { NextRequest } from 'next/server';
import { validateToken } from './jwt';
import { getAdminClient } from '@/lib/supabase-admin';
import type { AuthenticatedUser } from './types';

export type { AuthenticatedUser };


/**
 * Extrai e valida o usuário autenticado do request
 * 
 * @param request - NextRequest object
 * @returns AuthenticatedUser ou null se não autenticado
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    // 1. PRIMÁRIO: Tentar extrair token JWT do cookie httpOnly
    const token = request.cookies.get('auth_token')?.value;
    
    if (token) {
      const decoded = validateToken(token);
      
      if (decoded) {
        // Token JWT válido - buscar dados completos do banco
        const user = await fetchUserFromDatabase(decoded.auth_id);
        
        if (user) {
          // Aplicar bar_id do header se fornecido (multi-tenancy)
          const selectedBarId = request.headers.get('x-selected-bar-id');
          if (selectedBarId) {
            const barId = parseInt(selectedBarId);
            if (!isNaN(barId) && barId > 0) {
              // Validar se usuário tem acesso a este bar
              const hasAccess = await validateBarAccess(user.auth_id, barId);
              if (hasAccess) {
                user.bar_id = barId;
              }
            }
          }
          
          return user;
        }
      }
    }
    
    // 2. FALLBACK (DEPRECADO): Cookie legado sgb_user
    // Manter temporariamente para compatibilidade durante migração
    const legacyCookie = request.cookies.get('sgb_user')?.value;
    if (legacyCookie) {
      try {
        let rawValue = legacyCookie;
        try {
          rawValue = decodeURIComponent(rawValue);
        } catch {
          // Já decodificado
        }
        
        const userData = JSON.parse(rawValue);
        
        if (userData?.auth_id || userData?.id) {
          console.warn('⚠️ Usando cookie legado sgb_user - migrar para JWT');
          
          // Buscar dados atualizados do banco
          const user = await fetchUserFromDatabase(
            userData.auth_id || userData.id?.toString()
          );
          
          if (user) {
            // Aplicar bar_id do header se fornecido
            const selectedBarId = request.headers.get('x-selected-bar-id');
            if (selectedBarId) {
              const barId = parseInt(selectedBarId);
              if (!isNaN(barId) && barId > 0) {
                user.bar_id = barId;
              }
            } else if (userData.bar_id) {
              user.bar_id = userData.bar_id;
            }
            
            return user;
          }
        }
      } catch (error) {
        console.error('Erro ao processar cookie legado:', error);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao autenticar usuário:', error);
    return null;
  }
}

/**
 * Busca dados completos do usuário no banco de dados
 */
async function fetchUserFromDatabase(
  auth_id: string
): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await getAdminClient();
    
    const { data: usuario, error } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .eq('auth_id', auth_id)
      .eq('ativo', true)
      .single();
    
    if (error || !usuario) {
      console.error('Usuário não encontrado ou inativo:', auth_id);
      return null;
    }
    
    // Garantir que modulos_permitidos é array
    let modulosPermitidos: string[] = [];
    if (Array.isArray(usuario.modulos_permitidos)) {
      modulosPermitidos = usuario.modulos_permitidos;
    } else if (typeof usuario.modulos_permitidos === 'object' && usuario.modulos_permitidos) {
      modulosPermitidos = Object.keys(usuario.modulos_permitidos).filter(
        k => usuario.modulos_permitidos[k]
      );
    }
    
    // Buscar primeiro bar do usuário se não tiver bar_id
    let barId = usuario.bar_id;
    if (!barId) {
      const { data: userBars } = await supabase
        .schema('auth_custom')
        .from('usuarios_bares')
        .select('bar_id')
        .eq('usuario_id', usuario.auth_id)
        .limit(1);
      
      if (userBars && userBars.length > 0) {
        barId = userBars[0].bar_id;
      }
    }
    
    return {
      id: usuario.id,
      auth_id: usuario.auth_id,
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      bar_id: barId || 0,
      modulos_permitidos: modulosPermitidos,
      ativo: usuario.ativo,
      senha_redefinida: usuario.senha_redefinida ?? true,
      setor: usuario.setor,
      telefone: usuario.telefone,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    };
  } catch (error) {
    console.error('Erro ao buscar usuário no banco:', error);
    return null;
  }
}

/**
 * Valida se usuário tem acesso a um bar específico
 */
async function validateBarAccess(
  auth_id: string,
  bar_id: number
): Promise<boolean> {
  try {
    const supabase = await getAdminClient();
    
    // Verificar se é admin (tem acesso a todos os bares)
    const { data: usuario } = await supabase
      .schema('auth_custom')
      .from('usuarios')
      .select('role')
      .eq('auth_id', auth_id)
      .single();
    
    if (usuario?.role === 'admin') {
      return true;
    }
    
    // Verificar acesso específico ao bar
    const { data } = await supabase
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('bar_id')
      .eq('usuario_id', auth_id)
      .eq('bar_id', bar_id)
      .single();
    
    return !!data;
  } catch (error) {
    console.error('Erro ao validar acesso ao bar:', error);
    return false;
  }
}

/**
 * Extrai bar_id do request (header ou fallback para user.bar_id)
 */
export function getBarIdFromRequest(
  request: NextRequest,
  user: AuthenticatedUser
): number {
  const headerBarId = request.headers.get('x-selected-bar-id');
  
  if (headerBarId) {
    const barId = parseInt(headerBarId);
    if (!isNaN(barId) && barId > 0) {
      return barId;
    }
  }
  
  return user.bar_id;
}

/**
 * Verifica se usuário tem permissão para um módulo
 */
export function hasPermission(
  user: AuthenticatedUser,
  module: string
): boolean {
  // Admin tem todas as permissões
  if (user.role === 'admin') {
    return true;
  }
  
  // Verificar se tem o módulo ou 'todos'
  return (
    user.modulos_permitidos.includes(module) ||
    user.modulos_permitidos.includes('todos')
  );
}

/**
 * Verifica se usuário é admin
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'admin';
}