import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getStoneFechadoAte } from '@/lib/financeiro/stone-fechamento';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/conciliacao/contahub-nf?de=YYYY-MM-DD&ate=YYYY-MM-DD
 * Item 3: Venda total ContaHub/dia × NF emitida/dia (gold.conciliacao_contahub_nf_diaria).
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
    .from('conciliacao_contahub_nf_diaria')
    .select('data, contahub_total, contahub_cartao, stone_bruto, contahub_qtd, nf_autorizado, nf_qtd, diferenca')
    .eq('bar_id', user.bar_id)
    .gte('data', de).lte('data', ate)
    .order('data', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const stone_fechado_ate = await getStoneFechadoAte(supabase, user.bar_id).catch(() => null);

  return NextResponse.json({ success: true, linhas: data ?? [], stone_fechado_ate });
}
