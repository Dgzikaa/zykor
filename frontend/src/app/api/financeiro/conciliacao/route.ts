import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';
import { getStoneFechadoAte } from '@/lib/financeiro/stone-fechamento';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/conciliacao -> conciliação diária Stone × ContaHub do bar.
 *
 * Filtros (query): de=YYYY-MM-DD, ate=YYYY-MM-DD, status=ok|verificar,
 *   cnpj=<substr>, apenas_dif=1 (só dias com diferença ≠ 0).
 * Sempre retorna meses_disponiveis e cnpjs_disponiveis pro seletor da tela.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const de = searchParams.get('de');
  const ate = searchParams.get('ate');
  const status = searchParams.get('status');
  const cnpj = (searchParams.get('cnpj') || '').trim();
  const apenasDif = searchParams.get('apenas_dif') === '1';

  const supabase = await getAdminClient();

  // Linhas filtradas (paginado por segurança; cresce ~1/dia)
  let rows: any[];
  try {
    rows = await paginate<any>(
      () => {
        let q = (supabase as any)
          .schema('gold').from('mv_stone_conciliacao_diaria')
          .select('*')
          .eq('bar_id', user.bar_id)
          .order('data', { ascending: false });
        if (de) q = q.gte('data', de);
        if (ate) q = q.lte('data', ate);
        if (status) q = q.eq('status', status);
        return q;
      },
      { label: 'financeiro/conciliacao' },
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao buscar conciliação' }, { status: 500 });
  }

  const num = (v: any) => Number(v || 0);
  if (cnpj) rows = rows.filter((r) => (r.stone_cnpjs || '').toLowerCase().includes(cnpj.toLowerCase()));
  if (apenasDif) rows = rows.filter((r) => Math.abs(num(r.diferenca)) >= 0.01);

  const resumo = {
    dias: rows.length,
    ok: rows.filter((r) => r.status === 'ok').length,
    leve: rows.filter((r) => r.status === 'leve').length,
    verificar: rows.filter((r) => r.status === 'verificar').length,
    contahub_total: rows.reduce((s, r) => s + num(r.contahub_cartao), 0),
    stone_bruto_total: rows.reduce((s, r) => s + num(r.stone_bruto), 0),
    taxa_total: rows.reduce((s, r) => s + num(r.stone_taxa), 0),
    liquido_total: rows.reduce((s, r) => s + num(r.stone_liquido), 0),
    transacoes_total: rows.reduce((s, r) => s + num(r.stone_transacoes), 0),
    diferenca_abs_total: rows.reduce((s, r) => s + Math.abs(num(r.diferenca)), 0),
  };

  // Meses e CNPJs disponíveis (varredura leve: só data + cnpj do bar inteiro)
  const dimRows = await paginate<any>(
    () => (supabase as any)
      .schema('gold').from('mv_stone_conciliacao_diaria')
      .select('data, stone_cnpjs')
      .eq('bar_id', user.bar_id)
      .order('data', { ascending: false }),
    { label: 'financeiro/conciliacao/dims' },
  ).catch(() => [] as any[]);

  const mesesSet = new Set<string>();
  const cnpjsSet = new Set<string>();
  for (const r of dimRows) {
    if (typeof r.data === 'string') mesesSet.add(r.data.slice(0, 7)); // YYYY-MM
    if (r.stone_cnpjs) String(r.stone_cnpjs).split(/[,;]\s*/).forEach((c: string) => c && cnpjsSet.add(c.trim()));
  }
  const meses_disponiveis = Array.from(mesesSet).sort().reverse();
  const cnpjs_disponiveis = Array.from(cnpjsSet).sort();

  const stone_fechado_ate = await getStoneFechadoAte(supabase, user.bar_id).catch(() => null);

  return NextResponse.json({ success: true, conciliacao: rows, resumo, meses_disponiveis, cnpjs_disponiveis, stone_fechado_ate });
}
