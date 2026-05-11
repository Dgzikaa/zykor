import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/cancelamentos?bar_id=N&data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 *
 * Análise de cancelamentos: top motivos, top produtos, prejuízo R$, distribuição por hora.
 * Fonte: bronze.bronze_contahub_avendas_cancelamentos + silver.faturamento_pagamentos (denominador).
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

    // Cancelamentos
    const { data: canc, error: errC } = await supabase
      .schema('bronze' as never)
      .from('bronze_contahub_avendas_cancelamentos')
      .select('dt_gerencial, itm_qtd, itm_vrunitario, itm_vrcheio, grp_desc, prd_desc, motivocancdesconto, lancou, cancelou')
      .eq('bar_id', barId)
      .gte('dt_gerencial', dataInicio)
      .lte('dt_gerencial', dataFim);

    if (errC) {
      console.error('[insights/cancelamentos]', errC);
      return NextResponse.json({ error: errC.message }, { status: 500 });
    }

    // Faturamento bruto do período (denominador para % cancelamento)
    const { data: pagamentos } = await supabase
      .schema('silver' as never)
      .from('faturamento_pagamentos')
      .select('valor_bruto')
      .eq('bar_id', barId)
      .gte('data_pagamento', dataInicio)
      .lte('data_pagamento', dataFim);

    const fatBruto = (pagamentos ?? []).reduce((s: number, p: any) => s + (Number(p.valor_bruto) || 0), 0);

    type Cancel = {
      dt_gerencial: string;
      itm_qtd: number;
      itm_vrunitario: number;
      itm_vrcheio: number;
      grp_desc: string | null;
      prd_desc: string | null;
      motivocancdesconto: string | null;
      lancou: string | null;
      cancelou: string | null;
    };
    const rows = (canc ?? []) as Cancel[];

    let totalQtd = 0;
    let totalValor = 0;
    const porMotivo = new Map<string, { qtd: number; valor: number }>();
    const porGrupo = new Map<string, { qtd: number; valor: number }>();
    const porProduto = new Map<string, { qtd: number; valor: number }>();
    const porData = new Map<string, { qtd: number; valor: number }>();
    const porCancelou = new Map<string, { qtd: number; valor: number }>();

    for (const r of rows) {
      const qtd = Number(r.itm_qtd) || 0;
      // valor cheio (vrcheio) é o valor original; vrunitario é o praticado.
      const valor = (Number(r.itm_vrcheio) || Number(r.itm_vrunitario) || 0) * qtd;
      totalQtd += qtd;
      totalValor += valor;

      const motivo = (r.motivocancdesconto || 'Sem motivo').trim();
      const grupo = (r.grp_desc || 'Sem grupo').trim();
      const produto = (r.prd_desc || 'Sem produto').trim();
      const data = r.dt_gerencial;
      const cancelou = (r.cancelou || 'Desconhecido').trim();

      for (const [map, key] of [
        [porMotivo, motivo],
        [porGrupo, grupo],
        [porProduto, produto],
        [porData, data],
        [porCancelou, cancelou],
      ] as Array<[Map<string, { qtd: number; valor: number }>, string]>) {
        const cur = map.get(key) ?? { qtd: 0, valor: 0 };
        cur.qtd += qtd;
        cur.valor += valor;
        map.set(key, cur);
      }
    }

    const topN = (m: Map<string, { qtd: number; valor: number }>, n = 10) =>
      Array.from(m.entries())
        .map(([k, v]) => ({ nome: k, qtd: v.qtd, valor: v.valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, n);

    const evolucao_diaria = Array.from(porData.entries())
      .map(([data, v]) => ({ data, qtd: v.qtd, valor: v.valor }))
      .sort((a, b) => a.data.localeCompare(b.data));

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, data_fim: dataFim },
      resumo: {
        total_qtd_cancelada: totalQtd,
        total_valor_perdido: totalValor,
        faturamento_bruto_periodo: fatBruto,
        pct_cancelamento: fatBruto > 0 ? (totalValor / fatBruto) * 100 : 0,
        ticket_medio_cancelado: totalQtd > 0 ? totalValor / totalQtd : 0,
      },
      top_motivos: topN(porMotivo),
      top_grupos: topN(porGrupo),
      top_produtos: topN(porProduto),
      top_cancelou: topN(porCancelou),
      evolucao_diaria,
    });
  } catch (err) {
    console.error('[insights/cancelamentos] exceção', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
