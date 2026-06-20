import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/financeiro/beneficiarios/historico?q=&so_duplicados=1
 * Lista unificada por pessoa (gold.pagamentos_por_beneficiario): total pago, qtd de
 * pagamentos, quantos cadastros do CA foram fundidos, primeiro/último pagamento.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const termo = (sp.get('q') || '').trim();
  const soDup = sp.get('so_duplicados') === '1';

  const supabase = await getAdminClient();
  let q = (supabase.schema('gold' as any) as any)
    .from('pagamentos_por_beneficiario')
    .select('canonical_key, nome, documento, qtd_cadastros_ca, qtd_pagamentos, total_pago, primeiro_pgto, ultimo_pgto')
    .eq('bar_id', user.bar_id)
    .order('total_pago', { ascending: false })
    .limit(1000);
  if (termo) q = q.ilike('nome', `%${termo}%`);
  if (soDup) q = q.gt('qtd_cadastros_ca', 1);

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = data || [];
  const resumo = {
    pessoas: linhas.length,
    total_pago: linhas.reduce((s: number, r: any) => s + Number(r.total_pago || 0), 0),
    com_duplicados: linhas.filter((r: any) => Number(r.qtd_cadastros_ca) > 1).length,
  };
  return NextResponse.json({ success: true, beneficiarios: linhas, resumo });
}
