import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasRoutePermission, getRoutePermission } from './src/lib/route-permissions';
import { validateToken } from './src/lib/auth/jwt';
import { isPublicRoute } from './src/lib/auth/public-routes';
import { isApiRotaAberta } from './src/lib/auth/api-open-routes';

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
        console.log(`✅ MIDDLEWARE: Token JWT válido para ${decoded.email}`);
        return {
          id: decoded.user_id,
          email: decoded.email,
          nome: '', // Nome virá do banco se necessário
          role: decoded.role as 'admin' | 'funcionario' | 'financeiro',
          modulos_permitidos: decoded.modulos_permitidos,
          ativo: true, // Se token é válido, usuário está ativo
        };
      } else {
        console.log('⚠️ MIDDLEWARE: Token JWT inválido ou expirado');
      }
    }

    // 2. Fallback para cookie sgb_user (compatibilidade temporária)
    const sgbUserCookie = request.cookies.get('sgb_user')?.value;
    if (sgbUserCookie) {
      try {
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
        console.log(`✅ MIDDLEWARE: Cookie sgb_user válido para ${userData.email}`);
        return {
          ...userData,
          modulos_permitidos: modulosPermitidos,
        };
      } catch (parseError) {
        console.error('⚠️ MIDDLEWARE: Erro ao parsear sgb_user cookie:', parseError);
      }
    }

    console.log('🚫 MIDDLEWARE: Nenhuma autenticação válida encontrada');
    return null;
  } catch (error) {
    console.error('❌ MIDDLEWARE: Erro ao validar autenticação:', error);
    return null;
  }
}

// Rotas públicas (sem sessão) vêm da FONTE ÚNICA public-routes.ts — a mesma usada por
// SessionManager/PermissionGuard. Inclui /usuarios/redefinir-senha (1º acesso roda sem
// sessão); manter a lista aqui duplicada foi o que quebrou o primeiro acesso (loop pro login).

// Rotas que devem ser ignoradas pelo middleware
const IGNORED_ROUTES = ['/_next', '/favicon.ico', '/static'];
const BLOCKED_ROUTES = [
  '/configuracoes/usuarios',
  '/configuracoes/integracoes',
  '/configuracoes/fichas-tecnicas',
  '/configuracoes/checklists',
  '/configuracoes/calendario-operacional',
];

// Token de /api: aceita as MESMAS fontes que authenticateUser (Bearer OU cookie auth_token).
function getApiToken(request: NextRequest): string | null {
  const h = request.headers.get('authorization');
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return request.cookies.get('auth_token')?.value ?? null;
}

// TRAVA CENTRAL de /api: exige token válido em toda rota de API, exceto as liberadas
// (api-open-routes: público/webhook/cron). Só AUTENTICA (quem é você) — a autorização
// fina por módulo/ação continua no guard por rota (negarPorRota). Fecha de uma vez o
// acesso anônimo direto às rotas que só se protegiam pela tela.
function guardApi(request: NextRequest, pathname: string): NextResponse {
  if (request.method === 'OPTIONS') return NextResponse.next(); // preflight CORS
  if (isApiRotaAberta(pathname)) return NextResponse.next();
  // Chamadas de SISTEMA (Vercel cron, pg_cron, orquestrador, edge→app) se autenticam com
  // `Authorization: Bearer <segredo de servidor>` — CRON_SECRET ou SERVICE_ROLE_KEY. Deixa
  // passar quem apresenta o segredo (a própria rota revalida). Cobre até rota de sistema não
  // listada na allowlist, evitando 401 silencioso em pipeline. Segredo = confiança total.
  const bearer = getApiToken(request);
  if (
    bearer &&
    ((process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) ||
      (process.env.SUPABASE_SERVICE_ROLE_KEY && bearer === process.env.SUPABASE_SERVICE_ROLE_KEY))
  ) {
    return NextResponse.next();
  }
  const token = getApiToken(request);
  const decoded = token ? validateToken(token) : null;
  if (!decoded) {
    return NextResponse.json(
      { success: false, error: 'Não autenticado', code: 'NO_AUTH' },
      { status: 401 },
    );
  }
  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // /api entra pela trava central (401 JSON), nunca pela lógica de página (que redireciona).
  if (pathname.startsWith('/api/')) {
    return guardApi(request, pathname);
  }

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

  // Permitir rotas públicas (fonte única: public-routes.ts)
  if (isPublicRoute(pathname)) {
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
  // Inclui /api (trava central de auth). Continua fora: assets estáticos do Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
