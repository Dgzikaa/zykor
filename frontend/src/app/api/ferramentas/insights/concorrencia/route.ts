import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/concorrencia?bar_id=N&data_inicio=...&data_fim=...
 *
 * Eventos concorrentes + comparativo de receita em dias com vs sem evento competidor.
 * Fonte: operations.eventos_concorrencia + silver.faturamento_pagamentos.
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

    const { data: eventos, error: errE } = await supabase
      .schema('operations' as never)
      .from('eventos_concorrencia')
      .select('id, nome, local_nome, data_evento, horario_inicio, tipo, impacto, fonte, status, verificado')
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim)
      .order('data_evento', { ascending: true });

    if (errE) {
      console.error('[insights/concorrencia]', errE);
      return NextResponse.json({ error: errE.message }, { status: 500 });
    }

    // Faturamento por dia
    const { data: pagamentos } = await supabase
      .schema('silver' as never)
      .from('faturamento_pagamentos')
      .select('data_pagamento, valor_bruto')
      .eq('bar_id', barId)
      .gte('data_pagamento', dataInicio)
      .lte('data_pagamento', dataFim);

    const fatPorDia = new Map<string, number>();
    for (const p of pagamentos ?? []) {
      const d = (p as any).data_pagamento;
      fatPorDia.set(d, (fatPorDia.get(d) ?? 0) + (Number((p as any).valor_bruto) || 0));
    }

    // Dias com pelo menos 1 evento concorrente
    type E = { data_evento: string; impacto: string | null };
    const eventosArr = (eventos ?? []) as any[];
    const diasComEvento = new Set<string>();
    const diasComEventoForte = new Set<string>();
    for (const e of eventosArr) {
      diasComEvento.add(e.data_evento);
      if ((e.impacto || '').toLowerCase() === 'alto') diasComEventoForte.add(e.data_evento);
    }

    let somaComEvento = 0;
    let diasComEventoCount = 0;
    let somaSemEvento = 0;
    let diasSemEventoCount = 0;
    let somaComForte = 0;
    let diasComForteCount = 0;

    for (const [data, valor] of fatPorDia.entries()) {
      if (diasComEvento.has(data)) {
        somaComEvento += valor;
        diasComEventoCount += 1;
        if (diasComEventoForte.has(data)) {
          somaComForte += valor;
          diasComForteCount += 1;
        }
      } else {
        somaSemEvento += valor;
        diasSemEventoCount += 1;
      }
    }

    const mediaComEvento = diasComEventoCount > 0 ? somaComEvento / diasComEventoCount : 0;
    const mediaSemEvento = diasSemEventoCount > 0 ? somaSemEvento / diasSemEventoCount : 0;
    const mediaComForte = diasComForteCount > 0 ? somaComForte / diasComForteCount : 0;

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, data_fim: dataFim },
      resumo: {
        total_eventos_concorrentes: eventosArr.length,
        dias_com_evento: diasComEventoCount,
        dias_sem_evento: diasSemEventoCount,
        dias_com_evento_alto: diasComForteCount,
        media_fat_com_evento: mediaComEvento,
        media_fat_sem_evento: mediaSemEvento,
        media_fat_com_evento_alto: mediaComForte,
        impacto_pct: mediaSemEvento > 0 ? ((mediaComEvento - mediaSemEvento) / mediaSemEvento) * 100 : 0,
        impacto_alto_pct: mediaSemEvento > 0 ? ((mediaComForte - mediaSemEvento) / mediaSemEvento) * 100 : 0,
      },
      eventos: eventosArr,
    });
  } catch (err) {
    console.error('[insights/concorrencia] exceção', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
