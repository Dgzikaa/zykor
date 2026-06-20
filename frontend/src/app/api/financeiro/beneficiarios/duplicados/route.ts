import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET /api/financeiro/beneficiarios/duplicados — pares de nome parecido ainda não unificados. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).rpc('beneficiarios_duplicados_sugeridos', { p_bar_id: user.bar_id });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, pares: data || [] });
}
