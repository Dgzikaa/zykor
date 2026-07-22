import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasRoutePermission, getRoutePermission } from './src/lib/route-permissions';
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
    // Autorização de PÁGINA = SÓ o auth_token assinado, verificado no Edge por Web Crypto
    // (INFORJÁVEL). O jsonwebtoken não roda no Edge, por isso usamos decodificarTokenEdge.
    // O antigo fallback no cookie sgb_user (JSON não-httpOnly, forjável) foi REMOVIDO: dava
    // pra forjar {role:admin} e passar todos os guards de página. O login sempre seta o
    // auth_token (7d), então todo usuário logado passa aqui.
    const authToken = request.cookies.get('auth_token')?.value;
    if (authToken) {
      const decoded = await decodificarTokenEdge(authToken);
      if (decoded) {
        // Corte de re-login: token emitido antes do corte (global ou do usuário) → rejeita
        // → o fluxo trata como não-autenticado e manda pro /login (relogin com token fresco).
        if (decoded.iat) {
          const cortes = await getCortesEdge();
          const email = String(decoded.email || '').toLowerCase();
          const corte = Math.max(cortes.global, cortes.users[email] || 0);
          if (corte && decoded.iat < corte) return null;
        }
        const modulos = Array.isArray(decoded.modulos_permitidos)
          ? decoded.modulos_permitidos
          : typeof decoded.modulos_permitidos === 'object' && decoded.modulos_permitidos
            ? Object.keys(decoded.modulos_permitidos).filter((k) => decoded.modulos_permitidos[k])
            : [];
        return {
          id: decoded.user_id,
          email: decoded.email,
          nome: '',
          role: decoded.role as 'admin' | 'funcionario' | 'financeiro',
          modulos_permitidos: modulos,
          ativo: true,
        };
      }
    }
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
  // '/configuracoes/usuarios' REABERTA: a pagina existe (configuracoes/usuarios/page.tsx,
  // tabela de usuarios cadastrados, admin-only) e o menu (grupo Acesso) aponta pra ca. Estava
  // na lista antiga de rotas removidas e batia com o "Pagina removida" mesmo com o item de volta.
  '/configuracoes/integracoes',
  '/configuracoes/fichas-tecnicas',
  '/configuracoes/checklists',
  '/configuracoes/calendario-operacional',
];

// Verifica o JWT (HS256) no runtime EDGE usando Web Crypto — o `jsonwebtoken`/`validateToken`
// NÃO roda no Edge (usa crypto do Node), por isso o middleware não pode depender dele. Aqui
// checamos assinatura HMAC-SHA256 + expiração. Retorna true só p/ token realmente assinado
// com o JWT_SECRET → trava inforjável (o sgb_user não-httpOnly não passa por aqui).
function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
// Verifica a assinatura HS256 (Web Crypto) e devolve o PAYLOAD decodificado, ou null.
// É a prova de identidade inforjável usada tanto na trava /api quanto no roteamento de páginas.
async function decodificarTokenEdge(token: string): Promise<any | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret) as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(s) as BufferSource,
      new TextEncoder().encode(`${h}.${p}`) as BufferSource,
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
async function verificarTokenEdge(token: string): Promise<boolean> {
  return (await decodificarTokenEdge(token)) !== null;
}

// Cortes de re-login (mesma fonte do guard de API em src/middleware/auth.ts): corte
// GLOBAL ("deslogar todos" = system.auth_policy.min_iat) + POR USUÁRIO ("encerrar sessão"
// / mudança de permissão = system.user_token_cutoff). Token com iat < corte → rejeitado
// aqui no roteamento de PÁGINAS (antes só a API rejeitava; o token velho ainda navegava).
// Cache de 60s por isolate. FAIL-OPEN: qualquer erro de leitura mantém o valor anterior e
// NÃO bloqueia ninguém — o pior caso é o corte não valer por 1min, nunca um lockout geral.
let _cortesEdge: { global: number; users: Record<string, number>; t: number } = { global: 0, users: {}, t: 0 };
async function getCortesEdge(): Promise<{ global: number; users: Record<string, number> }> {
  const agora = Date.now();
  if (agora - _cortesEdge.t < 60_000) return _cortesEdge;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return _cortesEdge;
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'system' };
    const [gRes, uRes] = await Promise.all([
      fetch(`${url}/rest/v1/auth_policy?id=eq.1&select=min_iat`, { headers }),
      fetch(`${url}/rest/v1/user_token_cutoff?select=email,min_iat`, { headers }),
    ]);
    const gJson: any = gRes.ok ? await gRes.json() : [];
    const uJson: any = uRes.ok ? await uRes.json() : [];
    const users: Record<string, number> = {};
    if (Array.isArray(uJson)) {
      for (const r of uJson) users[String(r.email).toLowerCase()] = Number(r.min_iat || 0);
    }
    _cortesEdge = { global: Number(gJson?.[0]?.min_iat || 0), users, t: agora };
  } catch {
    _cortesEdge = { ..._cortesEdge, t: agora }; // fail-open: mantém valor anterior
  }
  return _cortesEdge;
}

// TRAVA CENTRAL de /api: exige token/sessão em toda rota de API, exceto as liberadas
// (api-open-routes: público/webhook/cron). Só AUTENTICA (quem é você) — a autorização fina
// por módulo continua no guard por rota (negarPorRota). Fecha o acesso ANÔNIMO direto às
// rotas que só se protegiam pela tela.
// Ordem: segredo de sistema → JWT assinado (auth_token/Bearer, verificado no Edge via Web
// Crypto = INFORJÁVEL) → fallback sessão de página (sgb_user) como rede p/ não deslogar
// ninguém que as páginas ainda aceitam.
async function guardApi(request: NextRequest, pathname: string): Promise<NextResponse> {
  if (request.method === 'OPTIONS') return NextResponse.next(); // preflight CORS
  if (isApiRotaAberta(pathname)) return NextResponse.next();

  const authHeader = request.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // 1) Chamadas de SISTEMA (Vercel cron, pg_cron, orquestrador, edge→app) com segredo de servidor.
  if (
    headerToken &&
    ((process.env.CRON_SECRET && headerToken === process.env.CRON_SECRET) ||
      (process.env.SUPABASE_SERVICE_ROLE_KEY && headerToken === process.env.SUPABASE_SERVICE_ROLE_KEY))
  ) {
    return NextResponse.next();
  }

  // 2) JWT assinado (real): cookie auth_token OU header Bearer, verificado no Edge (Web Crypto).
  //    Esta é a ÚNICA prova de identidade aceita em /api — INFORJÁVEL. O login sempre seta
  //    auth_token (JWT HS256, exp 7d = maxAge do cookie), então todo usuário logado passa aqui.
  //    O antigo fallback sgb_user (cookie não-httpOnly, forjável) foi REMOVIDO: era o furo-mestre
  //    que permitia forjar {role:admin} e passar a trava em toda rota /api. Segurança real agora.
  const cookieToken = request.cookies.get('auth_token')?.value ?? null;
  if (cookieToken && (await verificarTokenEdge(cookieToken))) return NextResponse.next();
  if (headerToken && (await verificarTokenEdge(headerToken))) return NextResponse.next();

  return NextResponse.json(
    { success: false, error: 'Não autenticado', code: 'NO_AUTH' },
    { status: 401 },
  );
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
    // Preserva o destino (path + query) no returnUrl → após o login o usuário cai
    // exatamente na URL que tentou abrir. Habilita atalhos deep-link (ex.: link
    // "Novo pedido de pagamento" fixado no grupo → /financeiro/pedidos-pagamento?novo=1).
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Verificar se usuário está ativo
  if (!user.ativo) {
    console.log('🚫 MIDDLEWARE: Usuário inativo bloqueado');
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
    console.log(`🚫 MIDDLEWARE: Sem permissão para ${pathname}`);
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
