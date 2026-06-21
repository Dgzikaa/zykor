import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/por-categoria        → resumo por categoria (classe)
 * GET /api/financeiro/beneficiarios/por-categoria?categoria=X → fornecedores daquela categoria
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const categoria = new URL(request.url).searchParams.get('categoria');
  const supabase = await getAdminClient();

  if (categoria) {
    const { data, error } = await (supabase as any).schema('financial').rpc('fornecedores_de_categoria', { p_bar_id: user.bar_id, p_categoria: categoria });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, fornecedores: (data || []).map((r: any) => ({ canonical_key: r.canonical_key, nome: r.nome, qtd: Number(r.qtd), total: Number(r.total) })) });
  }

  const { data, error } = await (supabase as any).schema('financial').rpc('beneficiarios_categoria_resumo', { p_bar_id: user.bar_id });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const categorias = (data || []).map((r: any) => {
    const total = Number(r.total); const meses = Number(r.meses) || 1;
    return {
      categoria: r.categoria, qtd_fornecedores: Number(r.qtd_fornecedores), qtd_pagamentos: Number(r.qtd_pagamentos),
      total, meses: Number(r.meses), media_mes: Math.round((total / meses) * 100) / 100,
    };
  });
  return NextResponse.json({ success: true, categorias });
}
