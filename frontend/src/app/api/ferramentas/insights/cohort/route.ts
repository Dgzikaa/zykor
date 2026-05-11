import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/cohort?bar_id=N&weeks=24&modo=aquisicao|periodo
 *
 * Cohort semanal de retenção:
 *   - linha = semana da PRIMEIRA visita do cliente (cohort week)
 *   - coluna = semanas após a primeira visita (0, 1, 2, …)
 *   - célula = % dos clientes daquela cohort que retornaram naquela semana
 *
 * Modos:
 *   - aquisicao (default): cohort = primeira visita HISTÓRICA do cliente.
 *     Mostra retenção de clientes recém-conquistados.
 *   - periodo: cohort = primeira visita do cliente DENTRO do recorte.
 *     Útil pra ver retenção mesmo de quem já era cliente antes.
 *
 * Fonte: silver.cliente_visitas (cliente_fone_norm + data_visita).
 */
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const weeks = Math.min(Number(sp.get('weeks') ?? 24), 52);
    const modo = (sp.get('modo') === 'periodo' ? 'periodo' : 'aquisicao') as 'aquisicao' | 'periodo';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
    }

    // Calcular data de início = N semanas atrás (do início da semana)
    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);
    const inicioMs = hoje.getTime() - weeks * 7 * 86400000;
    const dataInicio = new Date(inicioMs).toISOString().split('T')[0];

    // Buscar TODAS as visitas no período + primeira visita histórica de cada cliente
    // (precisa olhar histórico todo pra saber se a "primeira visita" é mesmo dentro do período)
    const { data: visitasPeriodo, error: errV } = await supabase
      .schema('silver' as never)
      .from('cliente_visitas')
      .select('cliente_fone_norm, data_visita')
      .eq('bar_id', barId)
      .gte('data_visita', dataInicio)
      .not('cliente_fone_norm', 'is', null);

    if (errV) {
      console.error('[cohort]', errV);
      return NextResponse.json({ error: errV.message }, { status: 500 });
    }

    type V = { cliente_fone_norm: string; data_visita: string };
    const rows = (visitasPeriodo ?? []) as V[];

    // Primeira visita de cada cliente DENTRO do período (cohort week)
    const primeiraVisita = new Map<string, string>();
    const visitasPorCliente = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.cliente_fone_norm) continue;
      const atual = primeiraVisita.get(r.cliente_fone_norm);
      if (!atual || r.data_visita < atual) primeiraVisita.set(r.cliente_fone_norm, r.data_visita);
      const lista = visitasPorCliente.get(r.cliente_fone_norm) ?? [];
      lista.push(r.data_visita);
      visitasPorCliente.set(r.cliente_fone_norm, lista);
    }

    // No modo "aquisicao", excluir clientes que já visitaram antes do período
    // (cohort de aquisição = clientes verdadeiramente novos).
    // No modo "periodo", todos contam, mesmo quem já era cliente antes.
    if (modo === 'aquisicao') {
      const fonesPeriodo = Array.from(primeiraVisita.keys());
      if (fonesPeriodo.length > 0) {
        const lotes: string[][] = [];
        const TAM = 1000;
        for (let i = 0; i < fonesPeriodo.length; i += TAM) lotes.push(fonesPeriodo.slice(i, i + TAM));

        for (const lote of lotes) {
          const { data: visitasAntes } = await supabase
            .schema('silver' as never)
            .from('cliente_visitas')
            .select('cliente_fone_norm')
            .eq('bar_id', barId)
            .lt('data_visita', dataInicio)
            .in('cliente_fone_norm', lote);
          for (const v of visitasAntes ?? []) {
            primeiraVisita.delete((v as any).cliente_fone_norm);
            visitasPorCliente.delete((v as any).cliente_fone_norm);
          }
        }
      }
    }

    // Função: data → início da semana (segunda-feira ISO) em string YYYY-MM-DD
    const semanaInicio = (data: string): string => {
      const d = new Date(data + 'T12:00:00Z');
      const dow = d.getUTCDay() || 7; // domingo=0 → 7
      const seg = new Date(d.getTime() - (dow - 1) * 86400000);
      return seg.toISOString().split('T')[0];
    };

    // Agrupar clientes por semana cohort (semana da primeira visita)
    const cohorts = new Map<string, Set<string>>();
    for (const [fone, primeira] of primeiraVisita.entries()) {
      const ck = semanaInicio(primeira);
      const set = cohorts.get(ck) ?? new Set<string>();
      set.add(fone);
      cohorts.set(ck, set);
    }

    // Para cada cohort, calcular retorno em cada semana subsequente
    const resultado: Array<{
      week_start: string;
      total_clientes: number;
      semanas: Array<{ week_offset: number; retained: number; pct: number }>;
    }> = [];

    const cohortsOrdenados = Array.from(cohorts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const hojeStr = hoje.toISOString().split('T')[0];

    for (const [weekStart, clientes] of cohortsOrdenados) {
      const total = clientes.size;
      const weekStartTs = new Date(weekStart + 'T12:00:00Z').getTime();
      const semanasMax = Math.floor((hoje.getTime() - weekStartTs) / (7 * 86400000));
      const semanas: Array<{ week_offset: number; retained: number; pct: number }> = [];

      for (let offset = 0; offset <= Math.min(semanasMax, weeks); offset++) {
        const ini = new Date(weekStartTs + offset * 7 * 86400000).toISOString().split('T')[0];
        const fim = new Date(weekStartTs + (offset + 1) * 7 * 86400000).toISOString().split('T')[0];
        if (ini > hojeStr) break;

        let retornaram = 0;
        for (const fone of clientes) {
          const visitas = visitasPorCliente.get(fone) ?? [];
          if (visitas.some(v => v >= ini && v < fim)) retornaram += 1;
        }
        semanas.push({
          week_offset: offset,
          retained: retornaram,
          pct: total > 0 ? (retornaram / total) * 100 : 0,
        });
      }

      resultado.push({ week_start: weekStart, total_clientes: total, semanas });
    }

    // Médias por semana_offset (linha "média")
    const mediaPorOffset = new Map<number, { soma_pct: number; count: number }>();
    for (const c of resultado) {
      // Pular cohort com poucos clientes pra não distorcer
      if (c.total_clientes < 5) continue;
      for (const s of c.semanas) {
        const cur = mediaPorOffset.get(s.week_offset) ?? { soma_pct: 0, count: 0 };
        cur.soma_pct += s.pct;
        cur.count += 1;
        mediaPorOffset.set(s.week_offset, cur);
      }
    }
    const media = Array.from(mediaPorOffset.entries())
      .map(([offset, v]) => ({ week_offset: offset, pct_medio: v.count > 0 ? v.soma_pct / v.count : 0 }))
      .sort((a, b) => a.week_offset - b.week_offset);

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, weeks, modo },
      cohorts: resultado,
      media_por_offset: media,
    });
  } catch (err: any) {
    console.error('[cohort] exceção', err);
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 });
  }
}
