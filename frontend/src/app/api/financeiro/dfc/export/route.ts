import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/dfc/export?bar_id=3&ano=2026&conciliado=1
 * Baixa a DFC por categoria × mês (net) em CSV (Excel pt-BR: separador ';', BOM p/ acentos)
 * pra conferência lado a lado com o export do Conta Azul.
 */
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const br = (n: number) => (n || 0).toFixed(2).replace('.', ',');

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();
    const soConciliado = sp.get('conciliado') === '1';

    const supabase = await getAdminClient();
    // gold.mv_dfc_ano = DFC materializada (idêntica à função, refresh horário) — ~0,3ms vs ~1s
    const { data, error } = await (supabase as any).schema('gold').from('mv_dfc_ano')
      .select('mes, grupo_dfc, categoria, categoria_macro, ordem_macro, ordem_sub, entradas, saidas, net')
      .eq('bar_id', barId).eq('ano', ano).eq('so_conciliado', soConciliado);
    if (error) throw error;

    // pivot: (grupo, categoria) -> [net por mês]
    const mapa = new Map<string, { grupo: string; categoria: string; meses: number[] }>();
    for (const r of (data || [])) {
      const key = `${r.grupo_dfc}||${r.categoria}`;
      if (!mapa.has(key)) mapa.set(key, { grupo: r.grupo_dfc, categoria: r.categoria, meses: Array(12).fill(0) });
      const mesIdx = new Date(r.mes).getUTCMonth();
      mapa.get(key)!.meses[mesIdx] += Number(r.net) || 0;
    }

    const linhas = Array.from(mapa.values()).sort((a, b) =>
      a.grupo.localeCompare(b.grupo) || a.categoria.localeCompare(b.categoria));

    const header = ['Grupo', 'Categoria', ...MESES, 'Total (ano)'];
    const rows = linhas.map(l => {
      const total = l.meses.reduce((s, v) => s + v, 0);
      return [l.grupo, l.categoria, ...l.meses.map(br), br(total)];
    });
    // linha de total geral por mês
    const totalMes = Array(12).fill(0);
    linhas.forEach(l => l.meses.forEach((v, i) => totalMes[i] += v));
    rows.push(['', 'TOTAL', ...totalMes.map(br), br(totalMes.reduce((s, v) => s + v, 0))]);

    const csv = [header, ...rows]
      .map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const bom = '﻿';

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dfc_${barId}_${ano}${soConciliado ? '_conciliado' : ''}.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
