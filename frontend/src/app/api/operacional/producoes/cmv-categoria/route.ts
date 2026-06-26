import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Média de CMV teórico por categoria (Bebida/Drink/Comida/Outros) nos últimos 90 dias.
 * Usado como baseline na Ficha Técnica (finalização) para indicar se o CMV do produto
 * está acima/abaixo da média da sua categoria.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold').rpc('fn_cmv_media_categoria', { p_bar: barId });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const medias: Record<string, number> = {};
  for (const r of (data || [])) if (r.categoria) medias[r.categoria] = Number(r.cmv_medio);
  return NextResponse.json({ success: true, medias });
}
