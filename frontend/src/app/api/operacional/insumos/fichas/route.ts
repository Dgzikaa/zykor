import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?bar_id&codigo=i0XXX → fichas (produtos/produções) onde o insumo é usado. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const codigo = String(sp.get('codigo') || '').trim();
  if (!barId || !codigo) return NextResponse.json({ success: false, error: 'bar_id e codigo obrigatórios' }, { status: 400 });
  const supabase = await getAdminClient();
  const { data, error } = await supabase.rpc('fn_insumo_fichas', { p_bar_id: barId, p_cod: codigo });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, fichas: data || [] });
}
