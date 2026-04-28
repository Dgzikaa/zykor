import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware Next.js — adiciona Cache-Control: no-store em todas as rotas
 * /api/*. Razao: dashboards do Zykor sao 100% dinamicos e qualquer cache
 * (browser, CDN, ISP proxy) pode entregar dado stale ao usuario. Cinto-
 * suspensorios universal.
 *
 * Endpoints especificos podem reescrever o header se precisarem de cache
 * (ex: /api/version retorna no-store explicito; rotas que nao re-usam o
 * mesmo header simplesmente sobrescrevem na resposta).
 *
 * NOTE: middleware roda em edge. NextResponse.next() encaminha pro handler
 * e os headers seteados aqui sao mesclados com a resposta final.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store, must-revalidate');
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
