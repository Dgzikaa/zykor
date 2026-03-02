import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasRoutePermission, getRoutePermission } from './src/lib/route-permissions';

interface User {
  id: number;
  email: string;
  nome: string;
  role: 'admin' | 'funcionario' | 'financeiro';
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

// Função para pegar dados do usuário dos cookies
function getStoredUser(request: NextRequest): User | null {
  try {
    // Tentar pegar do cookie sgb_user (usado pelo sistema de login)
    const sgbUserCookie = request.cookies.get('sgb_user')?.value;
    if (sgbUserCookie) {
      const userData = JSON.parse(decodeURIComponent(sgbUserCookie));
      return userData;
    }

    // Fallback para userData (compatibilidade)
    const userDataCookie = request.cookies.get('userData')?.value;
    if (userDataCookie) {
      const userData = JSON.parse(decodeURIComponent(userDataCookie));
      return userData;
    }

    return null;
  } catch (error) {
    console.error('Erro ao parsear dados do usuário:', error);
    return null;
  }
}

// Rotas que não precisam de autenticação
const PUBLIC_ROUTES = ['/login', '/auth', '/api'];

// Rotas que devem ser ignoradas pelo middleware
const IGNORED_ROUTES = ['/_next', '/favicon.ico', '/static'];

export function middleware(request: NextRequest) {
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

  // Verificar autenticação
  const user = getStoredUser(request);

  if (!user) {
    console.log(`🚫 MIDDLEWARE: Usuário não autenticado tentando acessar ${pathname}`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verificar se usuário está ativo
  if (!user.ativo) {
    console.log(`🚫 MIDDLEWARE: Usuário ${user.nome} está inativo`);
    return NextResponse.redirect(new URL('/login?error=usuario_inativo', request.url));
  }

  // Verificar permissões da rota
  const routeConfig = getRoutePermission(pathname);
  
  if (routeConfig) {
    const hasPermission = hasRoutePermission(pathname, user);
    
    if (!hasPermission) {
      console.log(`🚫 MIDDLEWARE: Usuário ${user.nome} (${user.role}) sem permissão para ${pathname}`);
      console.log(`   Módulos do usuário:`, user.modulos_permitidos);
      console.log(`   Módulos necessários:`, routeConfig.requiredModules);
      
      return NextResponse.redirect(
        new URL(`/home?error=acesso_negado&rota=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    
    console.log(`✅ MIDDLEWARE: Usuário ${user.nome} autorizado para ${pathname}`);
  } else {
    console.warn(`⚠️ MIDDLEWARE: Rota ${pathname} sem configuração de permissão`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
