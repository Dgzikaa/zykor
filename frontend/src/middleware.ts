import { NextRequest, NextResponse } from 'next/server';

// Rotas públicas (não requerem auth)
const PUBLIC_ROUTES = [
  '/login',
  '/auth',
  '/api/auth/login',
  '/api/auth/staff/login',
  '/api/auth/forgot-password',
  '/api/auth/staff/validate',
  '/api/health',
  '/api/auth/check-user',
  '/api/financeiro/contaazul/oauth/callback',
  '/_next',
  '/favicon.ico',
];

// Rotas de API que precisam de auth via header (não cookie)
const API_ROUTES_PREFIX = '/api/';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rotas públicas
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Permitir assets estáticos
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Para páginas (não API): verificar autenticação
  if (!pathname.startsWith(API_ROUTES_PREFIX)) {
    // Verificar cookie JWT (primário)
    const authToken = request.cookies.get('auth_token');
    
    // Fallback: cookie legado (DEPRECADO)
    // TODO(rodrigo/2026-05): Remover sgb_user quando migração estiver completa
    const legacyCookie = request.cookies.get('sgb_user');
    
    // Se não tem nenhum cookie de auth, redirecionar para login
    if (!authToken?.value && !legacyCookie?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Se tem cookie legado mas não tem JWT, permitir mas logar warning
    if (legacyCookie?.value && !authToken?.value) {
      console.warn('⚠️ Sessão legada detectada (sgb_user sem auth_token). Usuário deve fazer login novamente.');
      try {
        let rawValue = legacyCookie.value;
        try {
          rawValue = decodeURIComponent(rawValue);
        } catch {
          // Já está decodificado
        }
        const userData = JSON.parse(rawValue);
        if (!userData?.email || userData?.bar_id == null) {
          const loginUrl = new URL('/login', request.url);
          loginUrl.searchParams.set('reason', 'invalid_session');
          return NextResponse.redirect(loginUrl);
        }
      } catch {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('reason', 'corrupt_cookie');
        return NextResponse.redirect(loginUrl);
      }
    }

    return NextResponse.next();
  }

  // Para API routes: auth é verificada dentro da route via authenticateUser()
  // O middleware não bloqueia API routes (elas têm auth própria)
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
