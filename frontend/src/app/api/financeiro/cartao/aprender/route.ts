import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * Aprende as categorizações confirmadas: extrai uma palavra-chave do estabelecimento
 * de cada linha e grava em financial.cartao_categoria_map. Nas próximas faturas, a
 * sugestão vem direto daqui (mais rápida e precisa que a IA).
 * POST { linhas: [{ descricao, categoria_id, categoria_nome }] }
 */
const STOP = new Set(['pg', 'ec', 'pag', 'pagamento', 'compra', 'cartao', 'parcela', 'ltda', 'me', 'sa', 'com', 'br', 'do', 'da', 'de']);

function keywordDe(descricao: string): string | null {
  const limpo = (descricao || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[*\d]/g, ' ').replace(/[^a-z ]/g, ' ');
  const tokens = limpo.split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
  if (!tokens.length) return null;
  // token mais longo = geralmente o nome do estabelecimento
  return tokens.sort((a, b) => b.length - a.length)[0];
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  const linhas: any[] = Array.isArray(body.linhas) ? body.linhas : [];

  const supabase = await getAdminClient();
  // agrega por keyword (última categoria confirmada vence) e faz upsert somando hits
  const porKeyword = new Map<string, { categoria_id: string | null; categoria_nome: string }>();
  for (const l of linhas) {
    if (!l.categoria_nome) continue;
    const kw = keywordDe(String(l.descricao || ''));
    if (!kw) continue;
    porKeyword.set(kw, { categoria_id: l.categoria_id || null, categoria_nome: l.categoria_nome });
  }
  if (porKeyword.size === 0) return NextResponse.json({ success: true, aprendidos: 0 });

  let aprendidos = 0;
  for (const [keyword, cat] of porKeyword) {
    const { data: existente } = await fin(supabase).from('cartao_categoria_map')
      .select('hits').eq('bar_id', user.bar_id).eq('keyword', keyword).maybeSingle();
    const { error } = await fin(supabase).from('cartao_categoria_map').upsert({
      bar_id: user.bar_id, keyword,
      categoria_id: cat.categoria_id, categoria_nome: cat.categoria_nome,
      hits: (existente?.hits || 0) + 1, updated_at: new Date().toISOString(),
    }, { onConflict: 'bar_id,keyword' });
    if (!error) aprendidos++;
  }
  return NextResponse.json({ success: true, aprendidos });
}
