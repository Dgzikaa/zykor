import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/notas-fiscais -> consolidação diária de NF emitida por CNPJ.
 *
 * Fonte: gold.notas_fiscais_diaria (ContaHub qry=73, agrupado por data contábil
 * de emissão x índice de CNPJ). Filtros (query): de=YYYY-MM-DD, ate=YYYY-MM-DD.
 *
 * Retorna a tabela pivotada (1 linha por dia, 1 coluna por CNPJ) + resumo por CNPJ
 * + lista de meses disponíveis pro seletor.
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

  let rows: any[];
  try {
    rows = await paginate<any>(
      () => {
        let q = (supabase as any)
          .schema('gold').from('notas_fiscais_diaria')
          .select('*')
          .eq('bar_id', user.bar_id)
          .order('data', { ascending: false });
        if (de) q = q.gte('data', de);
        if (ate) q = q.lte('data', ate);
        return q;
      },
      { label: 'financeiro/notas-fiscais' },
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao buscar notas fiscais' }, { status: 500 });
  }

  // CNPJs presentes no período (ordenados por índice)
  const cnpjsMap = new Map<number, { indice: number; label: string; documento: string | null }>();
  for (const r of rows) {
    if (!cnpjsMap.has(r.cnpj_indice)) {
      cnpjsMap.set(r.cnpj_indice, { indice: r.cnpj_indice, label: r.cnpj_label, documento: r.cnpj_documento ?? null });
    }
  }
  const cnpjs = Array.from(cnpjsMap.values()).sort((a, b) => a.indice - b.indice);

  // Pivot: 1 linha por dia, valores por CNPJ
  const diasMap = new Map<string, any>();
  for (const r of rows) {
    if (!diasMap.has(r.data)) {
      diasMap.set(r.data, { data: r.data, por_cnpj: {} as Record<string, any>, total_autorizado: 0, total_cancelado: 0, qtd_notas: 0 });
    }
    const d = diasMap.get(r.data);
    d.por_cnpj[r.cnpj_indice] = {
      total_autorizado: num(r.total_autorizado),
      total_nfce: num(r.total_nfce),
      total_nfe: num(r.total_nfe),
      total_cancelado: num(r.total_cancelado),
      total_a_apurar: num(r.total_a_apurar),
      total_st_autorizado: num(r.total_st_autorizado),
      qtd_notas: num(r.qtd_notas),
      qtd_nfe: num(r.qtd_nfe),
      qtd_canceladas: num(r.qtd_canceladas),
    };
    d.total_autorizado += num(r.total_autorizado);
    d.total_cancelado += num(r.total_cancelado);
    d.qtd_notas += num(r.qtd_notas);
  }
  const dias = Array.from(diasMap.values()).sort((a, b) => (a.data < b.data ? 1 : -1));

  // Resumo por CNPJ + geral
  const por_cnpj: Record<string, any> = {};
  for (const c of cnpjs) por_cnpj[c.indice] = { total_autorizado: 0, total_cancelado: 0, qtd_notas: 0 };
  for (const r of rows) {
    por_cnpj[r.cnpj_indice].total_autorizado += num(r.total_autorizado);
    por_cnpj[r.cnpj_indice].total_cancelado += num(r.total_cancelado);
    por_cnpj[r.cnpj_indice].qtd_notas += num(r.qtd_notas);
  }
  const resumo = {
    dias: dias.length,
    total_autorizado: rows.reduce((s, r) => s + num(r.total_autorizado), 0),
    total_nfce: rows.reduce((s, r) => s + num(r.total_nfce), 0),
    total_nfe: rows.reduce((s, r) => s + num(r.total_nfe), 0),
    total_cancelado: rows.reduce((s, r) => s + num(r.total_cancelado), 0),
    qtd_notas: rows.reduce((s, r) => s + num(r.qtd_notas), 0),
    qtd_nfe: rows.reduce((s, r) => s + num(r.qtd_nfe), 0),
    por_cnpj,
  };

  // Meses disponíveis (varredura leve só da coluna data do bar inteiro)
  const dimRows = await paginate<any>(
    () => (supabase as any)
      .schema('gold').from('notas_fiscais_diaria')
      .select('data')
      .eq('bar_id', user.bar_id)
      .order('data', { ascending: false }),
    { label: 'financeiro/notas-fiscais/dims' },
  ).catch(() => [] as any[]);
  const mesesSet = new Set<string>();
  for (const r of dimRows) if (typeof r.data === 'string') mesesSet.add(r.data.slice(0, 7));
  const meses_disponiveis = Array.from(mesesSet).sort().reverse();

  return NextResponse.json({ success: true, cnpjs, dias, resumo, meses_disponiveis });
}
