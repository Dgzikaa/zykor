import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/dre/lancamentos?bar_id=&ano=&mes=&categoria_macro=&categoria_canon=
 * Lançamentos por trás de uma célula da DRE (drill-down). Usa a categorização da DRE
 * (financial.dre_categoria_macro via get_dre_lancamentos), NÃO a da Orçamentação.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const ano = Number(sp.get('ano'));
  const mes = Number(sp.get('mes'));
  const macro = (sp.get('categoria_macro') || '').trim();
  const canon = (sp.get('categoria_canon') || '').trim();

  if (!barId || !ano || !mes || !macro || !canon) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios: bar_id, ano, mes, categoria_macro, categoria_canon' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('financial').rpc('get_dre_lancamentos', {
    p_bar_id: barId, p_ano: ano, p_mes: mes, p_categoria_macro: macro, p_categoria_canon: canon,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lancamentos = (data || []).map((r: any) => ({
    data: r.data_competencia,
    data_pagamento: r.data_pagamento,
    descricao: r.descricao,
    pessoa: r.pessoa_nome,
    categoria: r.categoria_nome,
    tipo: r.tipo,
    status: r.status,
    valor: Number(r.valor) || 0,
  }));
  const total = lancamentos.reduce((s: number, l: any) => s + l.valor, 0);

  return NextResponse.json({
    success: true,
    lancamentos,
    total: Math.round(total * 100) / 100,
    count: lancamentos.length,
  });
}
