import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/meios-pagamento?bar_id=N&data_inicio=...&data_fim=...
 *
 * Mix de meios de pagamento + ticket médio por meio + evolução temporal.
 * Fonte: silver.faturamento_pagamentos.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const dataInicio = sp.get('data_inicio');
    const dataFim = sp.get('data_fim');

    if (!barId || !dataInicio || !dataFim) {
      return NextResponse.json({ error: 'bar_id, data_inicio e data_fim obrigatórios' }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema('silver' as never)
      .from('faturamento_pagamentos')
      .select('data_pagamento, meio, valor_bruto, valor_liquido, taxa')
      .eq('bar_id', barId)
      .gte('data_pagamento', dataInicio)
      .lte('data_pagamento', dataFim);

    if (error) {
      console.error('[insights/meios-pagamento]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type P = { data_pagamento: string; meio: string | null; valor_bruto: number; valor_liquido: number; taxa: number };
    const rows = (data ?? []) as P[];

    const porMeio = new Map<string, { qtd: number; valor_bruto: number; valor_liquido: number; taxa: number }>();
    const porDataMeio = new Map<string, Map<string, number>>();

    for (const r of rows) {
      const meio = (r.meio || 'Outros').trim();
      const cur = porMeio.get(meio) ?? { qtd: 0, valor_bruto: 0, valor_liquido: 0, taxa: 0 };
      cur.qtd += 1;
      cur.valor_bruto += Number(r.valor_bruto) || 0;
      cur.valor_liquido += Number(r.valor_liquido) || 0;
      cur.taxa += Number(r.taxa) || 0;
      porMeio.set(meio, cur);

      const m = porDataMeio.get(r.data_pagamento) ?? new Map<string, number>();
      m.set(meio, (m.get(meio) ?? 0) + (Number(r.valor_bruto) || 0));
      porDataMeio.set(r.data_pagamento, m);
    }

    const totalBruto = Array.from(porMeio.values()).reduce((s, x) => s + x.valor_bruto, 0);

    const distribuicao = Array.from(porMeio.entries())
      .map(([meio, v]) => ({
        meio,
        qtd_transacoes: v.qtd,
        valor_bruto: v.valor_bruto,
        valor_liquido: v.valor_liquido,
        taxa_total: v.taxa,
        ticket_medio: v.qtd > 0 ? v.valor_bruto / v.qtd : 0,
        pct: totalBruto > 0 ? (v.valor_bruto / totalBruto) * 100 : 0,
      }))
      .sort((a, b) => b.valor_bruto - a.valor_bruto);

    const evolucao_diaria = Array.from(porDataMeio.entries())
      .map(([data, m]) => {
        const obj: Record<string, any> = { data };
        for (const [meio, valor] of m.entries()) obj[meio] = valor;
        return obj;
      })
      .sort((a, b) => (a.data as string).localeCompare(b.data as string));

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, data_fim: dataFim },
      resumo: {
        faturamento_bruto_total: totalBruto,
        total_transacoes: Array.from(porMeio.values()).reduce((s, x) => s + x.qtd, 0),
        meios_distintos: porMeio.size,
      },
      distribuicao,
      evolucao_diaria,
    });
  } catch (err) {
    console.error('[insights/meios-pagamento] exceção', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
