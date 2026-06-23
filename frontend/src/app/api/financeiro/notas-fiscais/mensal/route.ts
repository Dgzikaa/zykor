import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/notas-fiscais/mensal -> série mensal de NF emitida por CNPJ,
 * com comparação ano-a-ano (YoY) contra o mesmo mês do ano anterior.
 *
 * Fonte: gold.notas_fiscais_diaria (agrega o histórico inteiro do bar por mês).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const num = (v: any) => Number(v || 0);

  let rows: any[];
  try {
    rows = await paginate<any>(
      () => (supabase as any)
        .schema('gold').from('notas_fiscais_diaria')
        .select('data, cnpj_indice, cnpj_label, cnpj_documento, total_autorizado, total_nfce, total_nfe, qtd_notas')
        .eq('bar_id', user.bar_id)
        .order('data', { ascending: true }),
      { label: 'financeiro/notas-fiscais/mensal' },
    );
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao buscar série mensal' }, { status: 500 });
  }

  // CNPJs presentes
  const cnpjsMap = new Map<number, { indice: number; label: string; documento: string | null }>();
  // Agregação por (ym, cnpj)
  const mesesMap = new Map<string, any>();
  for (const r of rows) {
    const ym = String(r.data).slice(0, 7); // YYYY-MM
    if (!cnpjsMap.has(r.cnpj_indice)) {
      cnpjsMap.set(r.cnpj_indice, { indice: r.cnpj_indice, label: r.cnpj_label, documento: r.cnpj_documento ?? null });
    }
    if (!mesesMap.has(ym)) {
      mesesMap.set(ym, { ym, por_cnpj: {} as Record<string, number>, total_autorizado: 0, total_nfce: 0, total_nfe: 0, qtd_notas: 0 });
    }
    const m = mesesMap.get(ym);
    m.por_cnpj[r.cnpj_indice] = num(m.por_cnpj[r.cnpj_indice]) + num(r.total_autorizado);
    m.total_autorizado += num(r.total_autorizado);
    m.total_nfce += num(r.total_nfce);
    m.total_nfe += num(r.total_nfe);
    m.qtd_notas += num(r.qtd_notas);
  }
  const cnpjs = Array.from(cnpjsMap.values()).sort((a, b) => a.indice - b.indice);

  // YoY: total do mesmo mês do ano anterior
  const totalPorYm = new Map<string, number>();
  for (const m of mesesMap.values()) totalPorYm.set(m.ym, m.total_autorizado);
  const anoAnterior = (ym: string) => { const [y, mm] = ym.split('-'); return `${Number(y) - 1}-${mm}`; };

  const meses = Array.from(mesesMap.values())
    .sort((a, b) => (a.ym < b.ym ? -1 : 1))
    .map((m) => {
      const prev = totalPorYm.get(anoAnterior(m.ym));
      const yoy_pct = prev && prev > 0 ? ((m.total_autorizado - prev) / prev) * 100 : null;
      return { ...m, total_ano_anterior: prev ?? null, yoy_pct };
    });

  return NextResponse.json({ success: true, cnpjs, meses });
}
