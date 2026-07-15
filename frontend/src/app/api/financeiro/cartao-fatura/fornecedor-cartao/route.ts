import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// =====================================================
// De-para "Fornecedor por cartão": cartao_final → fornecedor (TITULAR) do Conta Azul.
// Mapeia uma vez por cartão e reusa em toda fatura no lançamento.
// GET ?bar_id → lista do bar. POST { bar_id, cartao_final, contaazul_pessoa_id, nome, banco?, titular_nome? } → upsert.
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const barId = Number(new URL(request.url).searchParams.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { data, error } = await fin(supabase)
    .from('cartao_fornecedor_map')
    .select('cartao_final, banco, titular_nome, contaazul_pessoa_id, nome')
    .eq('bar_id', barId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, mapa: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'inserir')) return permissionErrorResponse('Sem permissão');

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const barId = Number(body.bar_id) || user.bar_id;
  const cartao_final = String(body.cartao_final || '').trim();
  const contaazul_pessoa_id = String(body.contaazul_pessoa_id || '').trim();
  if (!barId || !cartao_final || !contaazul_pessoa_id) {
    return NextResponse.json({ success: false, error: 'bar_id, cartao_final e contaazul_pessoa_id são obrigatórios' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await fin(supabase)
    .from('cartao_fornecedor_map')
    .upsert({
      bar_id: barId,
      cartao_final,
      banco: body.banco ? String(body.banco) : null,
      titular_nome: body.titular_nome ? String(body.titular_nome) : null,
      contaazul_pessoa_id,
      nome: body.nome ? String(body.nome) : null,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id,cartao_final' })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vinculo: data });
}
