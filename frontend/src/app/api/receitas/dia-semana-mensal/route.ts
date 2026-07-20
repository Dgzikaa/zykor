import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

/**
 * Faturamento por Dia da Semana × Mês (Dashboard de Receitas).
 * Para cada dia da semana (Seg..Dom), o faturamento MÉDIO por ocorrência em cada
 * mês do range — assim dá pra ver como cada dia performou mês a mês (detrator/promotor).
 * Média por ocorrência (não soma) pra comparar meses com nº de sábados diferente.
 *
 * GET ?bar_id=&inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 * Retorna { meses: [{key,label}], dias: [{ dia, [label]: media, ... }] }
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const de = sp.get('inicio') || sp.get('de');
  const ate = sp.get('fim') || sp.get('ate');
  // "sem outliers": exclui eventos marcados como esporádicos (jogo do Brasil etc.) da média
  const semOutliers = sp.get('sem_outliers') === '1' || sp.get('sem_outliers') === 'true';

  let q = supabase
    .from('eventos_base')
    .select('data_evento, real_r')
    .eq('bar_id', barId)
    .gt('real_r', 0)
    .order('data_evento', { ascending: true });
  if (de) q = q.gte('data_evento', de);
  if (ate) q = q.lte('data_evento', ate);
  if (semOutliers) q = q.eq('outlier', false);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // acc[dow][mesKey] = { soma, n }
  const acc: Record<number, Record<string, { soma: number; n: number }>> = {};
  const mesesSet = new Set<string>();
  for (const e of (data || []) as any[]) {
    const s = String(e.data_evento).slice(0, 10);
    const mesKey = s.slice(0, 7);
    const dow = new Date(s + 'T12:00:00Z').getUTCDay();
    mesesSet.add(mesKey);
    (acc[dow] ??= {});
    const a = acc[dow][mesKey] || { soma: 0, n: 0 };
    a.soma += Number(e.real_r) || 0;
    a.n += 1;
    acc[dow][mesKey] = a;
  }

  const meses = [...mesesSet].sort().map((key) => ({
    key,
    label: `${MESES[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`,
  }));

  const ordem = [1, 2, 3, 4, 5, 6, 0]; // Seg..Dom
  const dias = ordem.map((dow) => {
    const row: Record<string, any> = { dia: DIAS[dow] };
    let prev: number | null = null;
    for (const mes of meses) {
      const a = acc[dow]?.[mes.key];
      const val = a && a.n ? Math.round(a.soma / a.n) : 0;
      row[mes.label] = val;
      // variação vs mês anterior (mesmo dia da semana), pra ver o dia crescendo/caindo
      row[`${mes.label}__var`] = prev != null && prev > 0 && val > 0 ? Math.round(((val - prev) / prev) * 1000) / 10 : null;
      prev = val > 0 ? val : prev;
    }
    return row;
  });

  return NextResponse.json({ success: true, meses, dias });
}
