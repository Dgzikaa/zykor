import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasRoutePermission, getRoutePermission } from './src/lib/route-permissions';
import { validateToken } from './src/lib/auth/jwt';

interface User {
  id: number;
  email: string;
  nome: string;
  role: 'admin' | 'funcionario' | 'financeiro';
  modulos_permitidos: string[];
  ativo: boolean;
}

// Função para pegar dados do usuário validando JWT
async function getAuthenticatedUser(request: NextRequest): Promise<User | null> {
  try {
    // 1. Tentar pegar token JWT (prioridade)
    const authToken = request.cookies.get('auth_token')?.value;
    if (authToken) {
      const decoded = validateToken(authToken);
      if (decoded) {
        return {
          id: decoded.user_id,
          email: decoded.email,
          nome: '', // Nome virá do banco se necessário
          role: decoded.role as 'admin' | 'funcionario' | 'financeiro',
          modulos_permitidos: decoded.modulos_permitidos,
          ativo: true, // Se token é válido, usuário está ativo
        };
      }
    }

    // 2. Fallback para cookie sgb_user (compatibilidade temporária)
    const sgbUserCookie = request.cookies.get('sgb_user')?.value;
    if (sgbUserCookie) {
      const userData = JSON.parse(decodeURIComponent(sgbUserCookie));
      // Normalizar modulos_permitidos como array
      let modulosPermitidos: string[] = [];
      if (Array.isArray(userData.modulos_permitidos)) {
        modulosPermitidos = userData.modulos_permitidos;
      } else if (typeof userData.modulos_permitidos === 'object') {
        modulosPermitidos = Object.keys(userData.modulos_permitidos).filter(
          k => userData.modulos_permitidos[k]
        );
      }
      return {
        ...userData,
        modulos_permitidos: modulosPermitidos,
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ao validar autenticação:', error);
    return null;
  }
}

// Rotas que não precisam de autenticação
const PUBLIC_ROUTES = ['/login', '/auth', '/api'];

// Rotas que devem ser ignoradas pelo middleware
const IGNORED_ROUTES = ['/_next', '/favicon.ico', '/static'];
const BLOCKED_ROUTES = [
  '/configuracoes/usuarios',
  '/configuracoes/integracoes',
  '/configuracoes/fichas-tecnicas',
  '/configuracoes/checklists',
  '/configuracoes/calendario-operacional',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // Ignorar rotas estáticas e API
  if (IGNORED_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Redirecionar raiz para /login apenas em produção (domínio zykor.com.br)
  if (
    (hostname === 'zykor.com.br' || hostname === 'www.zykor.com.br') &&
    pathname === '/'
  ) {
    console.log(`🔄 REDIRECIONANDO ${pathname} para /login (hostname: ${hostname})`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Permitir rotas públicas
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Bloquear rotas antigas removidas da navegação
  if (
    BLOCKED_ROUTES.some(
      route => pathname === route || pathname.startsWith(`${route}/`)
    )
  ) {
    return new NextResponse('Página removida', { status: 404 });
  }

  // Verificar autenticação
  const user = await getAuthenticatedUser(request);

  if (!user) {
    console.log(`🚫 MIDDLEWARE: Usuário não autenticado tentando acessar ${pathname}`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar se usuário está ativo
  if (!user.ativo) {
    console.log(`🚫 MIDDLEWARE: Usuário ${user.nome || user.email} está inativo`);
    return NextResponse.redirect(new URL('/login?error=usuario_inativo', request.url));
  }

  // Verificar permissões da rota
  const routeConfig = getRoutePermission(pathname);
  
  if (!routeConfig) {
    // DENY BY DEFAULT - Bloquear rotas não configuradas
    console.error(`🚫 MIDDLEWARE: Rota não configurada: ${pathname}`);
    return NextResponse.redirect(
      new URL('/home?error=rota_nao_autorizada', request.url)
    );
  }
  
  const hasPermission = hasRoutePermission(pathname, user);
  
  if (!hasPermission) {
    console.log(`🚫 MIDDLEWARE: Usuário ${user.nome || user.email} (${user.role}) sem permissão para ${pathname}`);
    console.log(`   Módulos do usuário:`, user.modulos_permitidos);
    console.log(`   Módulos necessários:`, routeConfig.requiredModules);
    
    return NextResponse.redirect(
      new URL(`/home?error=acesso_negado&rota=${encodeURIComponent(pathname)}`, request.url)
    );
  }
  
  console.log(`✅ MIDDLEWARE: Usuário ${user.nome || user.email} autorizado para ${pathname}`);

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
