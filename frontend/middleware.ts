import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface User {
  id: number;
  email: string;
  nome: string;
  role: 'admin' | 'manager' | 'funcionario';
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

// Função para pegar dados do usuário dos cookies
function getStoredUser(request: NextRequest): User | null {
  try {
    const userDataCookie = request.cookies.get('userData')?.value;
    if (!userDataCookie) return null;

    const userData = JSON.parse(decodeURIComponent(userDataCookie));
    return userData;
  } catch (error) {
    console.error('Erro ao parsear dados do usuário:', error);
    return null;
  }
}

// Verificar se usuário tem permissão para marketing
function hasMarketingPermission(user: User): boolean {
  console.log(
    `🔍 VERIFICANDO MARKETING - User: ${user.nome}, Role: ${user.role}`
  );
  console.log(`🔍 MÓDULOS: ${JSON.stringify(user.modulos_permitidos)}`);

  // Admin sempre tem acesso
  if (user.role === 'admin') {
    console.log(`✅ ADMIN - Acesso liberado para ${user.nome}`);
    return true;
  }

  // Verificar se tem módulo marketing_360 (ID 18)
  let hasModule18 = false;
  let hasModuleMarketing = false;

  // Se modulos_permitidos é um array
  if (Array.isArray(user.modulos_permitidos)) {
    hasModule18 = user.modulos_permitidos.includes('18');
    hasModuleMarketing = user.modulos_permitidos.includes('marketing_360');
  }
  // Se modulos_permitidos é um objeto
  else if (typeof user.modulos_permitidos === 'object') {
    hasModule18 = user.modulos_permitidos['18'] === true;
    hasModuleMarketing = user.modulos_permitidos['marketing_360'] === true;
  }

  console.log(`🔍 Tem módulo 18? ${hasModule18}`);
  console.log(`🔍 Tem módulo marketing_360? ${hasModuleMarketing}`);

  const hasPermission = hasModule18 || hasModuleMarketing;
  console.log(`🔍 RESULTADO FINAL: ${hasPermission}`);

  return hasPermission;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // Redirecionar raiz para /login apenas em produção (domínio zykor.com.br)
  if (
    (hostname === 'zykor.com.br' || hostname === 'www.zykor.com.br') &&
    pathname === '/'
  ) {
    console.log(`🔄 REDIRECIONANDO ${pathname} para /login (hostname: ${hostname})`);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Só verificar marketing-360
  if (pathname === '/visao-geral/marketing-360') {
    console.log(`🎯 VERIFICANDO MARKETING-360`);

    const user = getStoredUser(request);

    if (!user) {
      console.log('🚫 MIDDLEWARE: Usuário não autenticado');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    console.log(`👤 USUÁRIO ENCONTRADO: ${JSON.stringify(user)}`);

    if (!hasMarketingPermission(user)) {
      console.log(
        `🚫 MIDDLEWARE: Usuário ${user.nome} (${user.role}) sem permissão para marketing`
      );
      return NextResponse.redirect(
        new URL('/home?error=sem_permissao_marketing', request.url)
      );
    }

    console.log(
      `✅ MIDDLEWARE: Usuário ${user.nome} autorizado para marketing`
    );
    console.log(
      `✅ MIDDLEWARE: Usuário ${user.nome} autorizado para marketing`
    );
  }

  // Verificar acesso a /estrategico (Apenas Admin)
  if (pathname.startsWith('/estrategico')) {
    const user = getStoredUser(request);

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (user.role !== 'admin') {
      console.log(`🚫 MIDDLEWARE: Usuário ${user.nome} sem permissão para estratégico`);
      return NextResponse.redirect(new URL('/home?error=sem_permissao_estrategico', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
