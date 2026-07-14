import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * GET /api/cmv-semanal/estoque-composicao?bar_id&ano
 *
 * Composição do Estoque Final do CMV por semana, pra reconciliar com a tela Estoque:
 *   Estoque Final CMV = Insumos (aba Estoque) − Alimentação (F, vai pro CMA) + Produções (aba Produção)
 * Base: silver.fn_estoque_composicao_ano (mesma contagem/valorização do Desvios).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const { searchParams } = new URL(request.url);
  const barIdParam = searchParams.get('bar_id');
  const anoParam = searchParams.get('ano');
  const barId = barIdParam ? parseInt(barIdParam) : user.bar_id;
  const ano = anoParam ? parseInt(anoParam) : new Date().getFullYear();

  if (!barId) {
    return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
  }

  const { data, error } = await supabase
    .schema('silver' as never)
    .rpc('fn_estoque_composicao_ano', { p_bar_id: barId, p_ano: ano });

  if (error) {
    console.error('[cmv-semanal/estoque-composicao]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const composicao = (data || []).map((r: any) => ({
    semana: Number(r.semana),
    data_usada: r.data_usada,
    insumo: Number(r.insumo) || 0,
    producao: Number(r.producao) || 0,
    alimentacao: Number(r.alimentacao) || 0,
  }));

  return NextResponse.json({ composicao });
}
