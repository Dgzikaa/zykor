import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';

/**
 * Custo manual de produtos do cardapio (operations.produto_custo_manual).
 *
 * GET  ?dias=90  -> lista produtos vendidos no periodo com custo efetivo + flag,
 *                   para preencher os que estao sem custo. bar_id vem do usuario.
 * POST { produto_codigo, produto_desc, custo, preco_venda? }
 *               -> grava/atualiza o custo manual (custo null/<0 remove). bar_id do usuario.
 *
 * Escrita exige admin ou financeiro (custo e dado financeiro).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);

  const dias = Number(req.nextUrl.searchParams.get('dias') ?? 90);
  const supabase = await getAdminClient();
  const { data, error } = await supabase.rpc('cardapio_produtos_custo', {
    p_bar_id: user.bar_id,
    p_dias: dias,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    bar_id: user.bar_id,
    dias,
    pode_editar: podeFinanceiro(user),
    produtos: data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  if (!podeFinanceiro(user))
    return permissionErrorResponse('Apenas admin ou financeiro podem editar custo de produto');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const produtoCodigo = String(body?.produto_codigo ?? '').trim();
  if (!produtoCodigo)
    return NextResponse.json({ error: 'produto_codigo obrigatório' }, { status: 400 });

  // custo null/'' => remove o custo manual; senão exige numero >= 0
  const custoRaw = body?.custo;
  let custo: number | null = null;
  if (custoRaw !== null && custoRaw !== undefined && String(custoRaw).trim() !== '') {
    custo = Number(custoRaw);
    if (!Number.isFinite(custo) || custo < 0)
      return NextResponse.json({ error: 'custo inválido' }, { status: 400 });
  }

  const precoRaw = body?.preco_venda;
  const preco =
    precoRaw === null || precoRaw === undefined || String(precoRaw).trim() === ''
      ? null
      : Number(precoRaw);

  const supabase = await getAdminClient();
  const { error } = await supabase.rpc('set_produto_custo_manual', {
    p_bar_id: user.bar_id,
    p_produto_codigo: produtoCodigo,
    p_produto_desc: body?.produto_desc ?? null,
    p_custo: custo,
    p_preco_venda: Number.isFinite(preco as number) ? preco : null,
    p_autor_id: user.id != null ? String(user.id) : null,
    p_autor_nome: user.nome ?? user.email ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, produto_codigo: produtoCodigo, custo });
}
