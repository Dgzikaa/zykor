import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { searchWiki } from '@/lib/wiki';

/**
 * GET /api/wiki/busca?q=termo&limit=12 → resultados da busca da wiki.
 *
 * Por que existe: a busca rodava no NAVEGADOR (`searchWiki` importado no WikiSearch, que é
 * client component). Isso arrastava `lib/wiki/generated.ts` — 1,2 MB com o texto de TODOS os
 * artigos — pro bundle, só pra filtrar string. As rotas /wiki chegavam a ~795 kB de first load.
 * Rodando aqui, o corpus fica no servidor e o cliente só recebe os hits que vai desenhar.
 *
 * A resposta é enxuta de propósito: só o que a lista mostra (título, área, snippet, path).
 * Nada de `excerpt`/`headings` completos, que é justamente o que pesava.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);

  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 12, 1), 50);

  if (!q) return NextResponse.json({ success: true, hits: [] });

  const hits = searchWiki(q, limit).map((h) => ({
    path: h.article.path,
    title: h.article.title,
    area: h.article.area,
    snippet: h.snippet,
  }));

  return NextResponse.json({ success: true, hits });
}
