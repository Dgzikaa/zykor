import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/instagram/inbox?bar_id=N
 *   → lista conversas + ultima mensagem
 * GET /api/instagram/inbox?bar_id=N&conversa_id=X
 *   → mensagens da conversa especifica (paginado)
 */
export const dynamic = 'force-dynamic';
export const revalidate = 30;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const conversaId = sp.get('conversa_id');
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const supabase = await getAdminClient();

    if (conversaId) {
      const { data: mensagens } = await (supabase as any)
        .schema('integrations').from('instagram_mensagens')
        .select('*').eq('bar_id', barId).eq('conversa_id', Number(conversaId))
        .order('enviada_em', { ascending: true })
        .limit(200);

      // Zerar nao_lidas ao abrir
      await (supabase as any).schema('integrations').from('instagram_conversas')
        .update({ nao_lidas_count: 0 }).eq('id', Number(conversaId));

      return NextResponse.json({ success: true, mensagens: mensagens || [] });
    }

    const { data: conversas } = await (supabase as any)
      .schema('integrations').from('instagram_conversas')
      .select('*').eq('bar_id', barId).eq('arquivada', false)
      .order('ultima_mensagem_em', { ascending: false, nullsFirst: false })
      .limit(100);

    const totalNaoLidas = (conversas || []).reduce((s: number, c: any) => s + (c.nao_lidas_count || 0), 0);

    return NextResponse.json({
      success: true,
      conversas: conversas || [],
      total_nao_lidas: totalNaoLidas,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
