import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/saidas-caixa -> "Saída de dinheiro do caixa" (sangria/retirada) por turno.
 *
 * Fonte: silver.contahub_caixa_saida (1 linha por retirada) + silver.contahub_caixa_turno_resumo
 * (balanços por turno). Vem do relatório de turno do ContaHub (getRelatorioTurnoHtml),
 * ingerido pela edge contahub-caixa-turno-sync. Filtros (query): de=YYYY-MM-DD, ate=YYYY-MM-DD.
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
    // Saídas (1 linha por retirada)
    const saidas = await paginate<any>(
      () => {
        let q = (supabase as any)
          .schema('silver').from('contahub_caixa_saida')
          .select('*')
          .eq('bar_id', user.bar_id)
          .order('dt_gerencial', { ascending: false })
          .order('trn', { ascending: false });
        if (de) q = q.gte('dt_gerencial', de);
        if (ate) q = q.lte('dt_gerencial', ate);
        return q;
      },
      { label: 'financeiro/saidas-caixa' },
    );

    // Resumo por turno (balanços)
    const turnos = await paginate<any>(
      () => {
        let q = (supabase as any)
          .schema('silver').from('contahub_caixa_turno_resumo')
          .select('*')
          .eq('bar_id', user.bar_id)
          .order('dt_gerencial', { ascending: false })
          .order('trn', { ascending: false });
        if (de) q = q.gte('dt_gerencial', de);
        if (ate) q = q.lte('dt_gerencial', ate);
        return q;
      },
      { label: 'financeiro/saidas-caixa/turnos' },
    ).catch(() => [] as any[]);

    // Entradas de caixa em dinheiro (por turno)
    const entradas = await paginate<any>(
      () => {
        let q = (supabase as any)
          .schema('silver').from('contahub_entrada_caixa_dinheiro')
          .select('*')
          .eq('bar_id', user.bar_id)
          .order('dt_gerencial', { ascending: false })
          .order('trn', { ascending: false });
        if (de) q = q.gte('dt_gerencial', de);
        if (ate) q = q.lte('dt_gerencial', ate);
        return q;
      },
      { label: 'financeiro/saidas-caixa/entradas' },
    ).catch(() => [] as any[]);

    const resumo = {
      dias: new Set(saidas.map((s) => s.dt_gerencial)).size,
      qtd_saidas: saidas.length,
      total_saidas: saidas.reduce((s, r) => s + num(r.valor_saida), 0),
      dias_entrada: new Set(entradas.map((e) => e.dt_gerencial)).size,
      qtd_entradas: entradas.length,
      total_entradas: entradas.reduce((s, r) => s + num(r.total_liquido), 0),
    };

    // Meses disponíveis (varredura leve só da coluna data)
    const dimRows = await paginate<any>(
      () => (supabase as any)
        .schema('silver').from('contahub_caixa_turno_resumo')
        .select('dt_gerencial')
        .eq('bar_id', user.bar_id)
        .order('dt_gerencial', { ascending: false }),
      { label: 'financeiro/saidas-caixa/dims' },
    ).catch(() => [] as any[]);
    const mesesSet = new Set<string>();
    for (const r of dimRows) if (typeof r.dt_gerencial === 'string') mesesSet.add(r.dt_gerencial.slice(0, 7));
    const meses_disponiveis = Array.from(mesesSet).sort().reverse();

    // Saídas já lançadas no CA (financial.saida_caixa_ca_log) — pro botão mostrar "lançado"
    const lancRows = await paginate<any>(
      () => (supabase as any)
        .schema('financial').from('saida_caixa_ca_log')
        .select('trn, num_lancamento, ca_protocol_id, baixado')
        .eq('bar_id', user.bar_id),
      { label: 'financeiro/saidas-caixa/lancados' },
    ).catch(() => [] as any[]);
    const lancados = lancRows.map((l) => ({ trn: l.trn, num_lancamento: l.num_lancamento, baixado: l.baixado }));

    // Entradas já lançadas no CA (financial.entrada_caixa_ca_log) — status por dia
    const entLog = await paginate<any>(
      () => (supabase as any)
        .schema('financial').from('entrada_caixa_ca_log')
        .select('dt_gerencial, valor, baixado')
        .eq('bar_id', user.bar_id),
      { label: 'financeiro/saidas-caixa/entradas-lancadas' },
    ).catch(() => [] as any[]);
    const entradas_lancadas = entLog.map((l) => ({ dt_gerencial: l.dt_gerencial, valor: l.valor, baixado: l.baixado }));

    return NextResponse.json({ success: true, saidas, entradas, turnos, resumo, meses_disponiveis, lancados, entradas_lancadas });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao buscar saídas de caixa' }, { status: 500 });
  }
}
