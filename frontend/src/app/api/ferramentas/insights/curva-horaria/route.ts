import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/curva-horaria?bar_id=N&data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 *
 * Distribuição de faturamento por hora no período + comparativo por dia da semana.
 * Fonte: silver.faturamento_hora.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const dataInicio = sp.get('data_inicio');
    const dataFim = sp.get('data_fim');

    if (!barId || !dataInicio || !dataFim) {
      return NextResponse.json({ error: 'bar_id, data_inicio e data_fim são obrigatórios' }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema('silver' as never)
      .from('faturamento_hora')
      .select('data_venda, hora, valor, quantidade')
      .eq('bar_id', barId)
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim);

    if (error) {
      console.error('[insights/curva-horaria]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type Row = { data_venda: string; hora: number; valor: number; quantidade: number };
    const rows = (data ?? []) as Row[];

    const dias = new Set<string>();
    const porHora = new Map<number, { faturamento: number; transacoes: number }>();
    const porDiaSemanaHora = new Map<string, { faturamento: number; dias: Set<string> }>();

    for (const r of rows) {
      const h = r.hora > 23 ? r.hora - 24 : r.hora;
      dias.add(r.data_venda);

      const cur = porHora.get(h) ?? { faturamento: 0, transacoes: 0 };
      cur.faturamento += Number(r.valor) || 0;
      cur.transacoes += Number(r.quantidade) || 0;
      porHora.set(h, cur);

      const dow = new Date(r.data_venda + 'T12:00:00').getDay();
      const key = `${dow}|${h}`;
      const ds = porDiaSemanaHora.get(key) ?? { faturamento: 0, dias: new Set() };
      ds.faturamento += Number(r.valor) || 0;
      ds.dias.add(r.data_venda);
      porDiaSemanaHora.set(key, ds);
    }

    const totalDias = dias.size || 1;

    const distribuicao_por_hora = Array.from(porHora.entries())
      .map(([hora, v]) => ({
        hora,
        faturamento_total: v.faturamento,
        faturamento_medio_dia: v.faturamento / totalDias,
        transacoes: v.transacoes,
      }))
      .sort((a, b) => {
        const ah = a.hora < 12 ? a.hora + 24 : a.hora;
        const bh = b.hora < 12 ? b.hora + 24 : b.hora;
        return ah - bh;
      });

    const totalFat = distribuicao_por_hora.reduce((s, x) => s + x.faturamento_total, 0);
    const horaPico = distribuicao_por_hora.reduce(
      (best, x) => (x.faturamento_total > best.faturamento_total ? x : best),
      { hora: 0, faturamento_total: 0, faturamento_medio_dia: 0, transacoes: 0 },
    );

    // Blocos
    const blocos = [
      { nome: 'Happy hour (17-19h)', faixa: [17, 19], faturamento: 0 },
      { nome: 'Jantar (19-22h)', faixa: [19, 22], faturamento: 0 },
      { nome: 'Balada (22-02h)', faixa: [22, 2], faturamento: 0 },
      { nome: 'Fim (02-04h)', faixa: [2, 4], faturamento: 0 },
    ];
    for (const r of distribuicao_por_hora) {
      for (const b of blocos) {
        const [ini, fim] = b.faixa;
        const inBloco = ini < fim ? r.hora >= ini && r.hora < fim : r.hora >= ini || r.hora < fim;
        if (inBloco) b.faturamento += r.faturamento_total;
      }
    }

    // Heatmap dia-semana × hora
    const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const heatmap: Array<{ dia_semana: string; hora: number; faturamento_medio: number }> = [];
    for (const [key, v] of porDiaSemanaHora.entries()) {
      const [dowStr, hStr] = key.split('|');
      heatmap.push({
        dia_semana: nomesDias[Number(dowStr)],
        hora: Number(hStr),
        faturamento_medio: v.faturamento / (v.dias.size || 1),
      });
    }

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, data_fim: dataFim, total_dias: totalDias },
      resumo: {
        faturamento_total: totalFat,
        faturamento_medio_dia: totalFat / totalDias,
        hora_pico: horaPico.hora,
        hora_pico_faturamento: horaPico.faturamento_total,
      },
      distribuicao_por_hora,
      blocos_horarios: blocos.map(b => ({ ...b, pct: totalFat > 0 ? (b.faturamento / totalFat) * 100 : 0 })),
      heatmap,
    });
  } catch (err) {
    console.error('[insights/curva-horaria] exceção', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
