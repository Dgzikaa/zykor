import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const dias = Number(sp.get('dias') ?? 30);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });

    const hoje = new Date().toISOString().split('T')[0];
    const fim = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];

    const supabase = await getAdminClient();

    // PostgREST corta em 1000 por request (db-max-rows) — paginar com .range() pra trazer TUDO.
    const PAGE = 1000;
    const lista: any[] = [];
    for (let from = 0; from <= 50000; from += PAGE) {
      const { data, error } = await (supabase as any).schema('crm').from('aniversariantes')
        .select('*')
        .eq('bar_id', barId)
        .gte('proximo_aniver', hoje)
        .lte('proximo_aniver', fim)
        .order('proximo_aniver')
        .order('valor_total_consumo', { ascending: false, nullsFirst: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const batch = data ?? [];
      lista.push(...batch);
      if (batch.length < PAGE) break; // última página
    }
    const hoje7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    // Contagem por nível (pros cards clicáveis)
    const por_nivel: Record<string, number> = {};
    for (const a of lista) {
      const n = a.nivel || 'sem_nivel';
      por_nivel[n] = (por_nivel[n] || 0) + 1;
    }

    const stats = {
      total: lista.length,
      esta_semana: lista.filter((a: any) => a.proximo_aniver <= hoje7).length,
      vips: lista.filter((a: any) => ['ouro', 'diamante'].includes(a.nivel)).length,
      gasto_total: lista.reduce((s: number, a: any) => s + Number(a.valor_total_consumo || 0), 0),
      com_telefone: lista.filter((a: any) => a.cliente_fone_norm).length,
      por_nivel,
    };
    return NextResponse.json({ aniversariantes: lista, stats });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
