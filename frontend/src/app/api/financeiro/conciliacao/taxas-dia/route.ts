import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/conciliacao/taxas-dia?de=&ate=&brand_id=&account_type=
 * Detalhe por dia (Valor/dia/bandeira/tipo) de uma bandeira+tipo da aba Taxas (MDR).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const de = sp.get('de');
  const ate = sp.get('ate');
  if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate obrigatórios' }, { status: 400 });
  const brandRaw = sp.get('brand_id');
  const accRaw = sp.get('account_type');

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).rpc('stone_taxas_dia', {
    p_bar_id: user.bar_id,
    p_de: de,
    p_ate: ate,
    p_brand_id: brandRaw === null || brandRaw === '' ? null : Number(brandRaw),
    p_account_type: accRaw === null || accRaw === '' ? null : Number(accRaw),
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, dias: data ?? [] });
}
