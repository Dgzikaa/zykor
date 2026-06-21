import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/detalhe?key=<canonical_key>
 * Todas as entradas e saídas (lançamentos do CA) de um beneficiário. Escopado ao bar.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const key = (new URL(request.url).searchParams.get('key') || '').trim();
  if (!key) return NextResponse.json({ success: false, error: 'key obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('financial').rpc('beneficiario_detalhe', { p_bar_id: user.bar_id, p_key: key });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const itens = (data || []).map((r: any) => ({
    data: r.data, competencia: r.competencia, descricao: r.descricao, tipo: r.tipo,
    categoria: r.categoria, valor: Number(r.valor), status: r.status, conciliado: r.conciliado,
  }));
  const entradas = itens.filter((i: any) => i.tipo === 'RECEITA').reduce((s: number, i: any) => s + i.valor, 0);
  const saidas = itens.filter((i: any) => i.tipo === 'DESPESA').reduce((s: number, i: any) => s + i.valor, 0);

  // quebra por categoria (a "classe" do fornecedor: onde o dinheiro dele cai)
  const mapaCat: Record<string, number> = {};
  for (const i of itens) { const c = i.categoria || '(sem categoria)'; mapaCat[c] = (mapaCat[c] || 0) + i.valor; }
  const categorias = Object.entries(mapaCat)
    .map(([categoria, valor]) => ({ categoria, valor: Math.round((valor as number) * 100) / 100 }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));

  return NextResponse.json({
    success: true, itens, categorias,
    resumo: {
      qtd: itens.length,
      entradas: Math.round(entradas * 100) / 100,
      saidas: Math.round(saidas * 100) / 100,
      categoria_principal: categorias[0]?.categoria || null,
    },
  });
}
