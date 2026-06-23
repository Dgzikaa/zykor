import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/conciliacao/analise?de=YYYY-MM-DD&ate=YYYY-MM-DD
 * Agregações Stone (MDR por bandeira, mix, maquininha, recebíveis, chargebacks)
 * via RPC public.stone_analise (tudo agregado no banco).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const de = searchParams.get('de') || null;
  const ate = searchParams.get('ate') || null;

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).rpc('stone_analise', {
    p_bar_id: user.bar_id, p_de: de, p_ate: ate,
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, analise: data });
}
