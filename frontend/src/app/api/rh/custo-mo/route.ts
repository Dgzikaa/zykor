import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?inicio=&fim= -> custo de mão de obra por dia (freelas reais + estimativa do fixo escalado). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const inicio = sp.get('inicio'); const fim = sp.get('fim');
  if (!inicio || !fim) return NextResponse.json({ success: false, error: 'inicio e fim obrigatórios' }, { status: 400 });
  // Filtro opcional por dia da semana (0=dom..6=sáb) — hub de Gráficos.
  const dowRaw = sp.get('dow');
  const dowFiltro = dowRaw != null && dowRaw !== '' ? Number(dowRaw) : null;

  const supabase = await getAdminClient();
  const [{ data: freelas }, { data: escalas }, { data: funcs }, { data: eventos }] = await Promise.all([
    (supabase as any).schema('hr').from('freela_convocacao').select('data, valor_diaria, status')
      .eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim).in('status', ['confirmado', 'compareceu']),
    (supabase as any).schema('hr').from('escalas').select('data, funcionario_id, status')
      .eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim),
    (supabase as any).schema('hr').from('funcionarios').select('id, salario_base').eq('bar_id', user.bar_id),
    (supabase as any).schema('operations').from('eventos_base').select('data_evento, nome')
      .eq('bar_id', user.bar_id).gte('data_evento', inicio).lte('data_evento', fim),
  ]);

  const salMap = new Map<number, number>();
  for (const f of funcs || []) salMap.set(f.id, Number(f.salario_base) || 0);
  const eventoMap = new Map<string, string>();
  for (const e of eventos || []) if (!eventoMap.has(e.data_evento)) eventoMap.set(e.data_evento, e.nome);

  const dias = new Map<string, { data: string; evento: string | null; freelas_custo: number; freelas_n: number; escalados_n: number; fixo_estimado: number }>();
  const get = (d: string) => { if (!dias.has(d)) dias.set(d, { data: d, evento: eventoMap.get(d) || null, freelas_custo: 0, freelas_n: 0, escalados_n: 0, fixo_estimado: 0 }); return dias.get(d)!; };

  for (const f of freelas || []) { const r = get(f.data); r.freelas_custo += Number(f.valor_diaria) || 0; r.freelas_n += 1; }
  for (const e of escalas || []) {
    if (e.status === 'folga' || e.status === 'falta') continue;
    const r = get(e.data); r.escalados_n += 1; r.fixo_estimado += (salMap.get(e.funcionario_id) || 0) / 30; // custo-dia ~ salário/30
  }

  const linhas = Array.from(dias.values())
    .filter((r) => dowFiltro == null || new Date(r.data + 'T12:00:00').getDay() === dowFiltro)
    .map((r) => ({ ...r, fixo_estimado: Math.round(r.fixo_estimado * 100) / 100, total: Math.round((r.freelas_custo + r.fixo_estimado) * 100) / 100 }))
    .sort((a, b) => b.data.localeCompare(a.data));

  const tot = linhas.reduce((s, r) => ({ freelas: s.freelas + r.freelas_custo, fixo: s.fixo + r.fixo_estimado, total: s.total + r.total }), { freelas: 0, fixo: 0, total: 0 });
  return NextResponse.json({ success: true, linhas, total: { freelas: Math.round(tot.freelas * 100) / 100, fixo: Math.round(tot.fixo * 100) / 100, total: Math.round(tot.total * 100) / 100 } });
}
