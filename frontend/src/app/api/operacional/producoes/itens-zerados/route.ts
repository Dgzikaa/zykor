import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?bar_id -> códigos de produtos/produções cuja ficha tem componente sem preço (R$0 — revisar). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const { data, error } = await (await getAdminClient() as any).schema('gold')
    .from('v_ficha_item_zerado').select('tipo, codigo').eq('bar_id', barId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const produtos = (data || []).filter((r: any) => r.tipo === 'produto').map((r: any) => r.codigo);
  const producoes = (data || []).filter((r: any) => r.tipo === 'producao').map((r: any) => r.codigo);
  return NextResponse.json({ success: true, produtos, producoes });
}
