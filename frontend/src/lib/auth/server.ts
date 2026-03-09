/**
 * Autenticação server-side
 * Usar em TODAS as APIs que precisam de autenticação
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { validateToken } from './jwt';
import type { AuthenticatedUser } from './types';

/**
 * Extrair token JWT do request
 */
async function extractToken(request: NextRequest): Promise<string | null> {
  // 1. Tentar header Authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    console.log('🔑 Token extraído do header Authorization');
    return authHeader.substring(7);
  }
  
  // 2. Tentar cookie auth_token
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    console.log('🔑 Token extraído do cookie auth_token');
    return cookieToken;
  }
  
  // 3. Fallback: cookie sgb_user (temporário para compatibilidade)
  const sgbUserCookie = request.cookies.get('sgb_user')?.value;
  if (sgbUserCookie) {
    try {
      const userData = JSON.parse(decodeURIComponent(sgbUserCookie));
      console.log('🔑 Token extraído do cookie sgb_user (fallback)');
      // Retornar como "token" para processamento
      return JSON.stringify(userData);
    } catch {
      // Ignorar erro
    }
  }
  
  // Log de todos os cookies recebidos para debug
  const allCookies = request.cookies.getAll();
  console.log('❌ Nenhum token encontrado. Cookies recebidos:', allCookies.map(c => c.name));
  
  return null;
}

/**
 * Buscar dados completos do usuário no banco
 */
async function fetchUserFromDatabase(
  auth_id: string,
  bar_id?: number
): Promise<AuthenticatedUser | null> {
  const supabase = await getAdminClient();
  
  console.log('🔍 fetchUserFromDatabase: Buscando auth_id =', auth_id);
  
  // Buscar usuário
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', auth_id)
    .eq('ativo', true)
    .single();
  
  if (error || !usuario) {
    console.log('❌ fetchUserFromDatabase: Erro ou usuário não encontrado', { error: error?.message, auth_id });
    return null;
  }
  
  console.log('✅ fetchUserFromDatabase: Usuário encontrado:', usuario.email);
  
  // Se bar_id não foi fornecido, buscar o primeiro bar do usuário
  let selectedBarId = bar_id;
  if (!selectedBarId) {
    const { data: userBars } = await supabase
      .from('usuarios_bares')
      .select('bar_id')
      .eq('usuario_id', usuario.auth_id)
      .limit(1);
    
    if (userBars && userBars.length > 0) {
      selectedBarId = userBars[0].bar_id;
    }
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
  
  return {
    id: usuario.id,
    auth_id: usuario.auth_id,
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.role,
    bar_id: selectedBarId || 0,
    modulos_permitidos: modulosPermitidos,
    ativo: usuario.ativo,
    senha_redefinida: usuario.senha_redefinida ?? true,
    setor: usuario.setor,
    telefone: usuario.telefone,
    created_at: usuario.created_at,
    updated_at: usuario.updated_at,
  };
}

/**
 * FUNÇÃO PRINCIPAL: Autenticar request
 * Usar em TODAS as APIs que precisam de autenticação
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    // 1. Extrair token
    const token = await extractToken(request);
    if (!token) {
      console.log('❌ authenticateRequest: Nenhum token extraído');
      return null;
    }
    
    // 2. Tentar validar como JWT
    const decoded = validateToken(token);
    if (decoded) {
      console.log('✅ Token JWT válido para:', decoded.email);
      // Token JWT válido - buscar dados atualizados do banco
      const user = await fetchUserFromDatabase(decoded.auth_id, decoded.bar_id);
      if (!user) {
        console.log('❌ Usuário não encontrado no banco para auth_id:', decoded.auth_id);
      }
      return user;
    }
    
    console.log('⚠️ Token JWT inválido, tentando fallback JSON...');
    
    // 3. Fallback: tentar parsear como JSON (compatibilidade com sistema antigo)
    try {
      const userData = JSON.parse(token);
      if (userData.auth_id || userData.id) {
        console.log('✅ Fallback JSON: encontrado auth_id/id');
        // Buscar dados atualizados do banco
        const user = await fetchUserFromDatabase(
          userData.auth_id || userData.id.toString(),
          userData.bar_id
        );
        return user;
      }
    } catch {
      console.log('❌ Fallback JSON falhou - token não é JSON válido');
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    return null;
  }
}

/**
 * Validar se usuário tem acesso a um bar específico
 */
export async function validateBarAccess(
  user: AuthenticatedUser,
  bar_id: number
): Promise<boolean> {
  // Admin tem acesso a todos os bares
  if (user.role === 'admin') {
    return true;
  }
  
  // Se é o bar atualmente selecionado, já foi validado
  if (user.bar_id === bar_id) {
    return true;
  }
  
  // Verificar no banco se usuário tem acesso
  const supabase = await getAdminClient();
  const { data } = await supabase
    .from('usuarios_bares')
    .select('bar_id')
    .eq('usuario_id', user.auth_id)
    .eq('bar_id', bar_id)
    .single();
  
  return !!data;
}

/**
 * HOC: Require Authentication
 * Wrapper para APIs que precisam de autenticação
 */
export function requireAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    ...args: any[]
  ) => Promise<Response>
) {
  return async (request: NextRequest, ...args: any[]) => {
    const user = await authenticateRequest(request);
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não autorizado',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    
    return handler(request, user, ...args);
  };
}

/**
 * HOC: Require Admin
 * Wrapper para APIs que só admin pode acessar
 */
export function requireAdmin(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    ...args: any[]
  ) => Promise<Response>
) {
  return requireAuth(async (request, user, ...args) => {
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: 'Acesso negado - apenas administradores',
          code: 'ADMIN_REQUIRED',
        },
        { status: 403 }
      );
    }
    
    return handler(request, user, ...args);
  });
}

/**
 * HOC: Require Permission
 * Wrapper para APIs que precisam de permissão específica
 */
export function requirePermission(module: string) {
  return function (
    handler: (
      request: NextRequest,
      user: AuthenticatedUser,
      ...args: any[]
    ) => Promise<Response>
  ) {
    return requireAuth(async (request, user, ...args) => {
      // Admin tem todas as permissões
      if (user.role === 'admin') {
        return handler(request, user, ...args);
      }
      
      // Verificar se tem o módulo ou 'todos'
      if (!user.modulos_permitidos.includes(module) && !user.modulos_permitidos.includes('todos')) {
        return NextResponse.json(
          {
            success: false,
            error: `Sem permissão para o módulo: ${module}`,
            code: 'PERMISSION_DENIED',
            required_module: module,
          },
          { status: 403 }
        );
      }
      
      return handler(request, user, ...args);
    });
  };
}

/**
 * HOC: Validate Bar Access
 * Wrapper para APIs que precisam validar acesso ao bar
 */
export function requireBarAccess(
  getBarId: (request: NextRequest) => number | Promise<number>
) {
  return function (
    handler: (
      request: NextRequest,
      user: AuthenticatedUser,
      ...args: any[]
    ) => Promise<Response>
  ) {
    return requireAuth(async (request, user, ...args) => {
      const bar_id = await getBarId(request);
      
      const hasAccess = await validateBarAccess(user, bar_id);
      if (!hasAccess) {
        return NextResponse.json(
          {
            success: false,
            error: 'Sem acesso a este estabelecimento',
            code: 'BAR_ACCESS_DENIED',
            bar_id,
          },
          { status: 403 }
        );
      }
      
      return handler(request, user, ...args);
    });
  };
}

/**
 * Respostas de erro padronizadas
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
