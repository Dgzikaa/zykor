import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/receitas/sympla -> recebíveis Sympla por evento (líquido a receber).
 *
 * Fonte: silver.sympla_recebiveis_evento (Σ order_total_net_value dos aprovados; cancelados 'C'
 * já fora — firma após a reverificação de cancelados). Previsão de repasse = dt_evento + 5 dias
 * ÚTEIS (pula fds + operations.feriados_eventos). Filtros: de/ate (YYYY-MM-DD) sobre dt_evento.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const de = searchParams.get('de');
  const ate = searchParams.get('ate');
  const supabase = await getAdminClient();
  const num = (v: any) => Number(v || 0);

  try {
    const eventos = await paginate<any>(
      () => {
        let q = (supabase as any)
          .schema('silver').from('sympla_recebiveis_evento')
          .select('*').eq('bar_id', user.bar_id)
          .order('dt_evento', { ascending: false, nullsFirst: false });
        if (de) q = q.gte('dt_evento', de);
        if (ate) q = q.lte('dt_evento', ate);
        return q;
      },
      { label: 'financeiro/receitas/sympla' },
    );

    // feriados p/ o cálculo de dias úteis
    const feriadosRows = await paginate<any>(
      () => (supabase as any).schema('operations').from('feriados_eventos').select('data'),
      { label: 'financeiro/receitas/sympla/feriados' },
    ).catch(() => [] as any[]);
    const feriados = new Set<string>(feriadosRows.map((f) => String(f.data)));

    const addDiasUteis = (dateStr: string, n: number): string | null => {
      if (!dateStr) return null;
      const d = new Date(`${dateStr}T12:00:00Z`);
      if (isNaN(d.getTime())) return null;
      let added = 0;
      while (added < n) {
        d.setUTCDate(d.getUTCDate() + 1);
        const dow = d.getUTCDay();
        const iso = d.toISOString().slice(0, 10);
        if (dow === 0 || dow === 6) continue;
        if (feriados.has(iso)) continue;
        added++;
      }
      return d.toISOString().slice(0, 10);
    };

    const itens = eventos.map((e) => ({
      event_id: e.event_id,
      nome_evento: e.nome_evento,
      dt_evento: e.dt_evento,
      pedidos: num(e.pedidos),
      bruto: num(e.bruto),
      taxa: num(e.taxa),
      liquido: num(e.liquido),
      cancelados: num(e.cancelados),
      previsao_repasse: addDiasUteis(e.dt_evento, 5),
      // Sympla→CA ainda não lança automático → status pendente. (log entra quando construirmos.)
      status: 'pendente' as const,
    }));

    const resumo = {
      eventos: itens.length,
      total_liquido: itens.reduce((s, r) => s + r.liquido, 0),
      total_bruto: itens.reduce((s, r) => s + r.bruto, 0),
      total_taxa: itens.reduce((s, r) => s + r.taxa, 0),
    };

    const mesesSet = new Set<string>();
    for (const e of eventos) if (typeof e.dt_evento === 'string') mesesSet.add(e.dt_evento.slice(0, 7));
    const meses_disponiveis = Array.from(mesesSet).sort().reverse();

    return NextResponse.json({ success: true, itens, resumo, meses_disponiveis });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao buscar recebíveis Sympla' }, { status: 500 });
  }
}
