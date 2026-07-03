import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** Resultados agregados das pesquisas (tela Configurações → Pesquisas). Só admin. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas administradores' }, { status: 403 });
  }

  const supabase = await getAdminClient();

  const [pesquisasRes, itensRes, respostasRes, respItensRes] = await Promise.all([
    supabase.schema('feedback').from('pesquisas')
      .select('id, slug, titulo, subtitulo, ativa, created_at')
      .order('created_at', { ascending: false }),
    supabase.schema('feedback').from('pesquisa_itens')
      .select('pesquisa_id, ordem, chave, titulo, tipo')
      .order('ordem', { ascending: true }),
    supabase.schema('feedback').from('respostas')
      .select('id, pesquisa_id, status, email, bar_id, respondida_em'),
    supabase.schema('feedback').from('respostas_itens')
      .select('resposta_id, item_chave, nota, texto'),
  ]);

  const pesquisas = (pesquisasRes.data || []) as any[];
  const itens = (itensRes.data || []) as any[];
  const respostas = (respostasRes.data || []) as any[];
  const respItens = (respItensRes.data || []) as any[];

  const respById = new Map(respostas.map((r) => [r.id, r]));

  const out = pesquisas.map((p) => {
    const pItens = itens.filter((i) => i.pesquisa_id === p.id);
    const pResp = respostas.filter((r) => r.pesquisa_id === p.id);
    const respondidasIds = new Set(pResp.filter((r) => r.status === 'respondida').map((r) => r.id));
    const pRespItens = respItens.filter((ri) => respondidasIds.has(ri.resposta_id));

    const itensAgg = pItens.map((i) => {
      if (i.tipo === 'nota_1_10') {
        const notas = pRespItens
          .filter((ri) => ri.item_chave === i.chave && ri.nota != null)
          .map((ri) => Number(ri.nota));
        const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
        return {
          chave: i.chave, titulo: i.titulo, tipo: i.tipo,
          media: media != null ? Math.round(media * 10) / 10 : null,
          respostas: notas.length,
        };
      }
      return {
        chave: i.chave, titulo: i.titulo, tipo: i.tipo, media: null,
        respostas: pRespItens.filter((ri) => ri.item_chave === i.chave && ri.texto).length,
      };
    });

    const comentarios = pRespItens
      .filter((ri) => ri.texto)
      .map((ri) => {
        const r = respById.get(ri.resposta_id);
        return { texto: ri.texto as string, email: r?.email ?? null, bar_id: r?.bar_id ?? null, respondida_em: r?.respondida_em ?? null };
      })
      .sort((a, b) => (a.respondida_em && b.respondida_em ? (a.respondida_em < b.respondida_em ? 1 : -1) : 0));

    return {
      id: p.id, slug: p.slug, titulo: p.titulo, subtitulo: p.subtitulo, ativa: p.ativa,
      total_respondidas: respondidasIds.size,
      total_adiadas: pResp.filter((r) => r.status === 'adiada').length,
      total_dispensadas: pResp.filter((r) => r.status === 'dispensada').length,
      itens: itensAgg,
      comentarios,
    };
  });

  return NextResponse.json({ success: true, pesquisas: out });
}
