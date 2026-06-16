import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const supabase = createServiceRoleClient();

/**
 * GET /api/analitico/clientes/rfm?bar_id=3[&segmento=Em risco][&limit=100]
 * Cliente 360 / RFM: resumo por segmento + lista de clientes (top por valor).
 * Fonte: crm.cliente_rfm (matview, refresh diário).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
    const segmento = sp.get('segmento');
    const limit = Math.min(Number(sp.get('limit')) || 100, 500);

    // Resumo por segmento (RPC agrega no banco)
    const { data: resumo, error: errResumo } = await (supabase as any).rpc('get_rfm_resumo', { p_bar_id: barId });
    if (errResumo) throw errResumo;

    // Lista de clientes (top por valor), opcionalmente filtrada por segmento
    let q = (supabase as any)
      .schema('crm')
      .from('cliente_rfm')
      .select('cliente_nome, cliente_fone_norm, segmento, frequencia, monetario, ticket_medio, recencia_dias, ultima_visita, primeira_visita')
      .eq('bar_id', barId)
      .order('monetario', { ascending: false })
      .limit(limit);
    if (segmento) q = q.eq('segmento', segmento);
    const { data: clientes, error: errCli } = await q;
    if (errCli) throw errCli;

    return NextResponse.json({
      success: true,
      resumo: resumo ?? [],
      clientes: clientes ?? [],
    });
  } catch (e: any) {
    console.error('[analitico/clientes/rfm] erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
