import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// GET — fatura + cartão + linhas.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'ver')) return permissionErrorResponse('Sem permissão');
  const { id } = await params;

  const supabase = await getAdminClient();
  const { data: fatura } = await fin(supabase)
    .from('cartao_faturas').select('*, cartao:cartao_cadastro(banco,tipo,dono)').eq('id', id).maybeSingle();
  if (!fatura || fatura.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Fatura não encontrada' }, { status: 404 });
  }
  const { data: linhas } = await fin(supabase)
    .from('cartao_fatura_linhas').select('*').eq('fatura_id', id).order('data_transacao', { ascending: false });
  return NextResponse.json({ success: true, fatura, linhas: linhas || [] });
}

// PATCH — encerrar/reabrir a fatura ou ajustar o valor informado.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'editar')) return permissionErrorResponse('Sem permissão');
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const supabase = await getAdminClient();
  const { data: fatura } = await fin(supabase).from('cartao_faturas').select('*').eq('id', id).maybeSingle();
  if (!fatura || fatura.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Fatura não encontrada' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (body.status === 'encerrada') {
    updates.status = 'encerrada'; updates.encerrada_em = new Date().toISOString(); updates.encerrada_por = user.auth_id;
  } else if (body.status === 'aberta') {
    updates.status = 'aberta'; updates.encerrada_em = null; updates.encerrada_por = null;
  }
  if ('valor_informado' in body) {
    const v = Number(body.valor_informado);
    updates.valor_informado = Number.isFinite(v) && v > 0 ? v : null;
  }

  const { data, error } = await fin(supabase).from('cartao_faturas').update(updates).eq('id', id)
    .select('*, cartao:cartao_cadastro(banco,tipo,dono)').single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, fatura: data });
}
