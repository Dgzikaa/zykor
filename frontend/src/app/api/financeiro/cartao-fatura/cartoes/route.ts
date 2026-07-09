import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// GET — cartões cadastrados do bar (Banco + Tipo + Dono).
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await fin(supabase)
    .from('cartao_cadastro').select('*').eq('bar_id', user.bar_id).eq('ativo', true)
    .order('banco').order('tipo');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, cartoes: data || [] });
}

// POST — cadastra um cartão { banco, tipo, dono }.
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const banco = String(body.banco || '').trim().toLowerCase();
  const tipo = String(body.tipo || '').trim();
  const dono = String(body.dono || '').trim();
  if (!banco || !tipo || !dono) {
    return NextResponse.json({ success: false, error: 'banco, tipo e dono são obrigatórios' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await fin(supabase)
    .from('cartao_cadastro').insert({ bar_id: user.bar_id, banco, tipo, dono }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, cartao: data });
}
