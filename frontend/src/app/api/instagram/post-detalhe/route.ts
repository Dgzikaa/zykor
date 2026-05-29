import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/post-detalhe?bar_id=N&ig_media_id=X
 *
 * Drilldown de um post: dados do post + insights + comments threaded.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const igMediaId = sp.get('ig_media_id');
    if (!barId || !igMediaId) {
      return NextResponse.json({ error: 'bar_id e ig_media_id obrigatorios' }, { status: 400 });
    }

    const supabase = await getAdminClient();

    const { data: post } = await (supabase as any)
      .schema('integrations').from('instagram_posts')
      .select('*').eq('bar_id', barId).eq('ig_media_id', igMediaId).maybeSingle();

    if (!post) {
      return NextResponse.json({ error: 'Post nao encontrado' }, { status: 404 });
    }

    const { data: insightsTodos } = await (supabase as any)
      .schema('integrations').from('instagram_post_insights')
      .select('*').eq('bar_id', barId).eq('ig_media_id', igMediaId)
      .order('data_snapshot', { ascending: true });

    const { data: comments } = await (supabase as any)
      .schema('integrations').from('instagram_comentarios')
      .select('*').eq('bar_id', barId).eq('ig_media_id', igMediaId)
      .order('timestamp_post', { ascending: true });

    // Estrutura em arvore: top-level + replies
    const byId = new Map<string, any>(
      (comments || []).map((c: any) => [c.ig_comment_id, { ...c, replies: [] as any[] }]),
    );
    const tree: any[] = [];
    for (const c of (comments || [])) {
      const node = byId.get((c as any).ig_comment_id);
      if (!node) continue;
      const parent = (c as any).parent_comment_id ? byId.get((c as any).parent_comment_id) : null;
      if (parent) {
        parent.replies.push(node);
      } else {
        tree.push(node);
      }
    }

    return NextResponse.json({
      success: true,
      post,
      insights_historico: insightsTodos,
      insights_atual: insightsTodos?.[insightsTodos.length - 1] || null,
      comments: tree,
      total_comments: comments?.length || 0,
    });
  } catch (e: any) {
    console.error('[ig/post-detalhe] excecao:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
