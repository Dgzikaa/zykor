import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/cac-roas?bar_id=N&ano=2026
 *
 * Usa a RPC public.cac_roas_mensal (SQL puro, rápido) — antes a lógica
 * era em JS iterando 50k+ clientes em lotes, dando timeout no Vercel
 * e perdendo meses.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano') ?? new Date().getFullYear());

    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

    const { data, error } = await (supabase as any).rpc('cac_roas_mensal', { p_bar_id: barId, p_ano: ano });
    if (error) {
      console.error('[cac-roas] RPC erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Row = { mes: number; mkt_investido: number; clientes_novos: number; fat_clientes_novos: number; cac: number; roas: number };
    const rows = (data ?? []) as Row[];

    const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const meses = rows.map(r => ({
      mes: r.mes,
      nome: NOMES_MES[r.mes - 1],
      mkt_investido: Number(r.mkt_investido) || 0,
      clientes_novos: Number(r.clientes_novos) || 0,
      fat_clientes_novos: Number(r.fat_clientes_novos) || 0,
      cac: Number(r.cac) || 0,
      roas: Number(r.roas) || 0,
    }));

    const mktTotal = meses.reduce((s, m) => s + m.mkt_investido, 0);
    const novosTotal = meses.reduce((s, m) => s + m.clientes_novos, 0);
    const fatTotal = meses.reduce((s, m) => s + m.fat_clientes_novos, 0);

    return NextResponse.json({
      success: true,
      ano,
      resumo: {
        mkt_total: mktTotal,
        clientes_novos_total: novosTotal,
        fat_clientes_novos_total: fatTotal,
        cac_medio: novosTotal > 0 ? mktTotal / novosTotal : 0,
        roas_medio: mktTotal > 0 ? fatTotal / mktTotal : 0,
      },
      meses,
    });
  } catch (err: any) {
    console.error('[cac-roas] exceção', err);
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 });
  }
}
