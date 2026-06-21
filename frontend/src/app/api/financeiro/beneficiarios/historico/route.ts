import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/historico?q=&so_duplicados=1&page=1&limit=100
 * Lista PAGINADA por pessoa (gold.pagamentos_por_beneficiario) + resumo sobre TODO o
 * conjunto filtrado (não só a página). Sempre escopado ao bar do usuário.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const termo = (sp.get('q') || '').trim();
  const soDup = sp.get('so_duplicados') === '1';
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '100'), 10), 200);
  const offset = (page - 1) * limit;

  const supabase = await getAdminClient();

  // resumo sobre tudo (RPC agrega — não sofre do limite de 1k)
  const { data: resumoRows } = await (supabase as any).schema('financial').rpc('beneficiarios_resumo', {
    p_bar_id: user.bar_id, p_q: termo || null, p_so_dup: soDup,
  });
  const r0 = (resumoRows && resumoRows[0]) || {};
  const resumo = {
    pessoas: Number(r0.pessoas || 0),
    total_pago: Number(r0.total_pago || 0),
    com_duplicados: Number(r0.com_duplicados || 0),
  };

  // página da lista (range + count exato p/ total de páginas)
  let q = (supabase.schema('gold' as any) as any)
    .from('pagamentos_por_beneficiario')
    .select('canonical_key, nome, documento, qtd_cadastros_ca, qtd_pagamentos, total_pago, primeiro_pgto, ultimo_pgto', { count: 'exact' })
    .eq('bar_id', user.bar_id)
    .order('total_pago', { ascending: false })
    .range(offset, offset + limit - 1);
  if (termo) q = q.ilike('nome', `%${termo}%`);
  if (soDup) q = q.gt('qtd_cadastros_ca', 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    beneficiarios: data || [],
    resumo,
    total: count ?? resumo.pessoas,
    page,
    limit,
  });
}
