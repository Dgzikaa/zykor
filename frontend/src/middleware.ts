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

  // Para páginas (não API): verificar cookie de sessão
  if (!pathname.startsWith(API_ROUTES_PREFIX)) {
    const sessionCookie = request.cookies.get('sgb_user');

    if (!sessionCookie?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Validar que o cookie contém dados válidos
    try {
      const userData = JSON.parse(decodeURIComponent(sessionCookie.value));
      if (!userData?.email || !userData?.bar_id) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url));
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
