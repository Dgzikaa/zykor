import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

/**
 * Motor de Detratores/Promotores (Bloco 3) — faturamento MÉDIO por dia da semana,
 * comparado em 3 janelas contra o mês de referência:
 *   - YoY: mesmo mês no ano anterior
 *   - MoM: mês anterior
 *   - Tri: média dos 3 meses anteriores (trimestre anterior)
 *
 * Média POR OCORRÊNCIA (não soma) pra comparar meses com nº de sábados diferente.
 * Cada dia da semana vira promotor (Δ ≥ +3%) ou detrator (Δ ≤ −3%) por janela.
 *
 * GET ?bar_id=&mes=YYYY-MM   (mes default = mês corrente)
 */
export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

function addMonths(ano: number, m: number, delta: number): { ano: number; m: number } {
  const idx = ano * 12 + (m - 1) + delta;
  return { ano: Math.floor(idx / 12), m: (idx % 12) + 1 };
}
function mesRange(ano: number, m: number): { start: string; end: string } {
  const start = `${ano}-${String(m).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(ano, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}
function mesLabel(ano: number, m: number): string {
  return `${MESES[m - 1]}/${String(ano).slice(2)}`;
}
const dentro = (d: string, r: { start: string; end: string }) => d >= r.start && d <= r.end;

export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const mesParam = sp.get('mes'); // YYYY-MM
  const hoje = new Date();
  const ano = mesParam ? Number(mesParam.slice(0, 4)) : hoje.getUTCFullYear();
  const m = mesParam ? Number(mesParam.slice(5, 7)) : hoje.getUTCMonth() + 1;

  const atual = mesRange(ano, m);
  const mom = mesRange(...(Object.values(addMonths(ano, m, -1)) as [number, number]));
  const yoy = mesRange(ano - 1, m);
  const tri3 = addMonths(ano, m, -3);
  const tri = { start: mesRange(tri3.ano, tri3.m).start, end: mom.end };

  // Busca a maior janela necessária (do início do YoY até o fim do mês atual).
  const spanStart = yoy.start < tri.start ? yoy.start : tri.start;
  const { data, error } = await supabase
    .from('eventos_base')
    .select('data_evento, real_r')
    .eq('bar_id', barId)
    .gte('data_evento', spanStart)
    .lte('data_evento', atual.end)
    .gt('real_r', 0);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // acc[janela][dow] = { soma, n }
  const janelas = { atual, yoy, mom, tri } as const;
  const acc: Record<string, Record<number, { soma: number; n: number }>> = {
    atual: {}, yoy: {}, mom: {}, tri: {},
  };
  for (const e of (data || []) as any[]) {
    const d = String(e.data_evento).slice(0, 10);
    const dow = new Date(d + 'T12:00:00Z').getUTCDay();
    const fat = Number(e.real_r) || 0;
    for (const [nome, r] of Object.entries(janelas)) {
      if (dentro(d, r)) {
        const a = acc[nome][dow] || { soma: 0, n: 0 };
        a.soma += fat; a.n += 1;
        acc[nome][dow] = a;
      }
    }
  }

  const media = (nome: string, dow: number): number | null => {
    const a = acc[nome][dow];
    return a && a.n ? Math.round(a.soma / a.n) : null;
  };
  const delta = (at: number | null, base: number | null): number | null =>
    at != null && base != null && base > 0 ? Math.round(((at - base) / base) * 1000) / 10 : null;
  const classifica = (d: number | null) => (d == null ? null : d >= 3 ? 'promotor' : d <= -3 ? 'detrator' : 'estavel');

  const ordem = [1, 2, 3, 4, 5, 6, 0]; // Seg..Dom
  const dias = ordem.map((dow) => {
    const at = media('atual', dow);
    const y = media('yoy', dow), mm = media('mom', dow), tr = media('tri', dow);
    const dY = delta(at, y), dM = delta(at, mm), dT = delta(at, tr);
    return {
      dow, dia: DIAS[dow], atual: at,
      yoy: y, mom: mm, tri: tr,
      delta_yoy: dY, delta_mom: dM, delta_tri: dT,
      classe_yoy: classifica(dY), classe_mom: classifica(dM), classe_tri: classifica(dT),
    };
  });

  return NextResponse.json({
    success: true,
    mes: `${ano}-${String(m).padStart(2, '0')}`,
    labels: { atual: mesLabel(ano, m), yoy: mesLabel(ano - 1, m), mom: mesLabel(mom.start.slice(0, 4) as any, Number(mom.start.slice(5, 7))), tri: `${mesLabel(tri3.ano, tri3.m)}–${mesLabel(Number(mom.start.slice(0, 4)), Number(mom.start.slice(5, 7)))}` },
    dias,
  });
}
