import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// =====================================================
// PATCH — classifica uma linha: bar, categoria e/ou status ('ignorado'/'novo').
//   Não toca em linhas já lançadas (status 'lancado').
// =====================================================
const CAMPOS = ['bar_id', 'categoria_id', 'categoria_nome', 'status'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'editar')) return permissionErrorResponse('Sem permissão');
  const { id } = await params;

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }

  const supabase = await getAdminClient();
  const { data: linha } = await fin(supabase).from('cartao_fatura_linhas').select('*').eq('id', id).maybeSingle();
  if (!linha) return NextResponse.json({ success: false, error: 'Linha não encontrada' }, { status: 404 });
  if (linha.status === 'lancado') {
    return NextResponse.json({ success: false, error: 'Linha já lançada no Conta Azul' }, { status: 409 });
  }

  const updates: Record<string, unknown> = {};
  for (const c of CAMPOS) if (c in body) updates[c] = body[c];
  if (updates.status && !['novo', 'ignorado'].includes(String(updates.status))) {
    return NextResponse.json({ success: false, error: 'status inválido (novo|ignorado)' }, { status: 400 });
  }
  if (!Object.keys(updates).length) return NextResponse.json({ success: true, linha });

  updates.atualizado_em = new Date().toISOString();
  const { data, error } = await fin(supabase).from('cartao_fatura_linhas').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, linha: data });
}
