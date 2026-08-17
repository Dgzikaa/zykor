import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { paginate } from '@/lib/supabase/paginate';

/**
 * Ticket Médio por Dia da Semana × Mês (Dashboard de Receitas).
 * Irmão do `dia-semana-mensal` (que traz faturamento) — aqui o ticket, quebrado
 * em PORTA (couvert/entrada) + BAR (consumo), pra ver de qual lado o TM caiu.
 *
 * Régua (igual à de /api/analitico/evento):
 *   - couvert = faturamento_couvert_manual || faturamento_couvert
 *   - bar     = faturamento − couvert (o que não é couvert é consumo)
 *   - ticket  = PONDERADO: SUM(valor) / SUM(cl_real) do bucket, nunca média de médias.
 * Assim porta + bar fecha exatamente com o ticket total do bucket.
 *
 * Só entram eventos com público (cl_real > 0) — evento com faturamento e sem
 * público lançado inflaria o numerador sem denominador.
 *
 * GET ?bar_id=&inicio=YYYY-MM-DD&fim=YYYY-MM-DD[&sem_outliers=1]
 * Retorna { meses: [{key,label}], dias: [{ dia, `${label}__porta`, `${label}__bar`, `${label}__var` }] }
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);

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
  // "sem outliers": exclui eventos marcados como esporádicos (jogo do Brasil etc.)
  const semOutliers = sp.get('sem_outliers') === '1' || sp.get('sem_outliers') === 'true';

  let eventos: any[];
  try {
    eventos = await paginate<any>(() => {
      let q = supabase
        .from('eventos_base')
        .select('data_evento, real_r, cl_real, faturamento_couvert, faturamento_couvert_manual')
        .eq('bar_id', barId)
        .gt('real_r', 0)
        .gt('cl_real', 0)
        .order('data_evento', { ascending: true });
      if (de) q = q.gte('data_evento', de);
      if (ate) q = q.lte('data_evento', ate);
      if (semOutliers) q = q.eq('outlier', false);
      return q;
    }, { label: 'receitas/ticket-dia-semana-mensal' });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'erro ao buscar eventos' }, { status: 500 });
  }

  // acc[dow][mesKey] = { couvert, bar, publico }
  const acc: Record<number, Record<string, { couvert: number; bar: number; publico: number }>> = {};
  const mesesSet = new Set<string>();
  for (const e of eventos) {
    const s = String(e.data_evento).slice(0, 10);
    const mesKey = s.slice(0, 7);
    const dow = new Date(s + 'T12:00:00Z').getUTCDay();
    mesesSet.add(mesKey);

    const fat = num(e.real_r);
    const couvert = Math.min(num(e.faturamento_couvert_manual) || num(e.faturamento_couvert), fat);
    (acc[dow] ??= {});
    const a = acc[dow][mesKey] || { couvert: 0, bar: 0, publico: 0 };
    a.couvert += couvert;
    a.bar += Math.max(0, fat - couvert);
    a.publico += num(e.cl_real);
    acc[dow][mesKey] = a;
  }

  const meses = [...mesesSet].sort().map((key) => ({
    key,
    label: `${MESES[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`,
  }));

  const cent = (v: number) => Math.round(v * 100) / 100;
  const ordem = [1, 2, 3, 4, 5, 6, 0]; // Seg..Dom
  const dias = ordem.map((dow) => {
    const row: Record<string, any> = { dia: DIAS[dow] };
    let prev: number | null = null;
    for (const mes of meses) {
      const a = acc[dow]?.[mes.key];
      const porta = a && a.publico ? cent(a.couvert / a.publico) : 0;
      const bar = a && a.publico ? cent(a.bar / a.publico) : 0;
      const total = cent(porta + bar);
      row[`${mes.label}__porta`] = porta;
      row[`${mes.label}__bar`] = bar;
      row[`${mes.label}__total`] = total;
      // variação do ticket TOTAL vs mês anterior (mesmo dia da semana) — a "queda"
      row[`${mes.label}__bar__var`] = prev != null && prev > 0 && total > 0 ? Math.round(((total - prev) / prev) * 1000) / 10 : null;
      prev = total > 0 ? total : prev;
    }
    return row;
  });

  return NextResponse.json({ success: true, meses, dias });
}
