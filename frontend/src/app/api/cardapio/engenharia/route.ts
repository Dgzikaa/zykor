import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/cardapio/engenharia?bar_id=N&dias=30
 * → produtos classificados: Star/Plowhorse/Puzzle/Dog + agregados por classe.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 600;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 30);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const fim = new Date().toISOString().split('T')[0];
    const ini = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).rpc('menu_engineering', {
      p_bar_id: barId, p_data_ini: ini, p_data_fim: fim,
    }, { count: 'exact' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const produtos = (data ?? []).map((p: any) => ({
      ...p,
      qtd_vendida: Number(p.qtd_vendida),
      receita_total: Number(p.receita_total),
      custo_total: Number(p.custo_total),
      preco_medio: Number(p.preco_medio),
      custo_medio: Number(p.custo_medio),
      margem_unitaria: Number(p.margem_unitaria),
      margem_total: Number(p.margem_total),
      margem_perc: Number(p.margem_perc),
      popularidade_norm: Number(p.popularidade_norm),
      margem_norm: Number(p.margem_norm),
    }));

    const porClasse: Record<string, any> = { star: [], plowhorse: [], puzzle: [], dog: [] };
    for (const p of produtos) porClasse[p.classificacao]?.push(p);

    const resumo: Record<string, any> = {};
    for (const c of ['star', 'plowhorse', 'puzzle', 'dog']) {
      const arr = porClasse[c];
      resumo[c] = {
        qtd: arr.length,
        receita_total: arr.reduce((s: number, p: any) => s + p.receita_total, 0),
        margem_total: arr.reduce((s: number, p: any) => s + p.margem_total, 0),
        margem_perc_media: arr.length
          ? arr.reduce((s: number, p: any) => s + p.margem_perc, 0) / arr.length
          : 0,
      };
    }

    return NextResponse.json({
      success: true,
      periodo: { ini, fim, dias },
      total_produtos: produtos.length,
      resumo,
      por_classe: porClasse,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
