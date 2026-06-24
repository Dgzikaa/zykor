import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/conciliacao/nf-stone-cnpj?de=YYYY-MM-DD&ate=YYYY-MM-DD
 * Item 2: NF emitida por CNPJ/dia × Venda Stone por CNPJ/dia (gold.conciliacao_nf_stone_cnpj_diaria).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const de = searchParams.get('de');
  const ate = searchParams.get('ate');
  if (!de || !ate) return NextResponse.json({ success: false, error: 'de e ate obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold')
    .from('conciliacao_nf_stone_cnpj_diaria')
    .select('data, cnpj_indice, cnpj_documento, cnpj_label, nf_autorizado, nf_qtd, nf_cancelado, stone_bruto, stone_qtd, diferenca')
    .eq('bar_id', user.bar_id)
    .gte('data', de).lte('data', ate)
    .order('data', { ascending: false }).order('cnpj_indice', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, linhas: data ?? [] });
}
