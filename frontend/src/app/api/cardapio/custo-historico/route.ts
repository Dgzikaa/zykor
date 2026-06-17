import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/cardapio/custo-historico?dias=90
 *   → mudancas de custo/preco (o que mudou e quando). bar_id do usuario.
 * GET /api/cardapio/custo-historico?produto_codigo=X&dias=180
 *   → serie temporal (evolucao) de custo/preco de um produto.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);

  const sp = req.nextUrl.searchParams;
  const dias = Number(sp.get('dias') ?? 90);
  const produtoCodigo = sp.get('produto_codigo');
  const supabase = await getAdminClient();

  if (produtoCodigo) {
    const { data, error } = await supabase.rpc('cardapio_custo_serie', {
      p_bar_id: user.bar_id,
      p_produto_codigo: produtoCodigo,
      p_dias: Number(sp.get('dias') ?? 180),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, produto_codigo: produtoCodigo, serie: data ?? [] });
  }

  const { data, error } = await supabase.rpc('cardapio_custo_mudancas', {
    p_bar_id: user.bar_id,
    p_dias: dias,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, bar_id: user.bar_id, dias, mudancas: data ?? [] });
}
