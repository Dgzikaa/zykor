import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import { getLancadorAdmin, round2, primeiroDiaMes, mesAnteriorBRT } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CADASTRO DE BONIFICAÇÕES (financial.bonificacoes). A galera insere a bonificação quando ela chega
 * (fornecedor, valor, referente, competência, data que chegou). É a fonte pra Gestão CMV mensal e
 * pro lançamento 1 a 1 no Conta Azul (ver ./lancar). Categoria "Ajuste Bonificações".
 *
 *  - GET    : lista as bonificações de uma competência (mês) + total.
 *  - POST   : cadastra 1 bonificação.
 *  - DELETE : exclui 1 bonificação (só se ainda não foi lançada no CA).
 */

function anoMesAlvo(url: URL): { ano: number; mes: number } {
  const ano = Number(url.searchParams.get('ano'));
  const mes = Number(url.searchParams.get('mes'));
  if (Number.isFinite(ano) && Number.isFinite(mes) && mes >= 1 && mes <= 12) return { ano, mes };
  return mesAnteriorBRT();
}

/** GET: lista da competência. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const { ano, mes } = anoMesAlvo(url);
  const competencia = primeiroDiaMes(ano, mes);

  const supabase = getLancadorAdmin();
  const { data, error } = await (supabase.schema('financial' as any) as any)
    .from('bonificacoes')
    .select('id, fornecedor, referente, valor, competencia, data_chegada, categoria_nome, ca_lancado, ca_protocol_id, lancado_em')
    .eq('bar_id', barId).eq('competencia', competencia)
    .order('data_chegada', { ascending: true }).order('id', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bonificacoes = (data as any[]) || [];
  const total = bonificacoes.reduce((s, b) => s + Number(b.valor || 0), 0);
  const total_lancado = bonificacoes.filter((b) => b.ca_lancado).reduce((s, b) => s + Number(b.valor || 0), 0);
  return NextResponse.json({ bar_id: barId, ano, mes, competencia, total: round2(total), total_lancado: round2(total_lancado), bonificacoes });
}

/** POST: cadastra 1 bonificação. Body: { bar_id?, fornecedor, valor, referente?, ano, mes, data_chegada? }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para cadastrar');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const fornecedor = String(body?.fornecedor || '').trim();
  const referente = body?.referente != null ? String(body.referente).trim() : null;
  const valor = round2(Number(body?.valor));
  const ano = Number(body?.ano);
  const mes = Number(body?.mes);
  const dataChegada = body?.data_chegada ? String(body.data_chegada) : null;

  if (!barId || !fornecedor || !(valor > 0) || !Number.isFinite(ano) || !(mes >= 1 && mes <= 12)) {
    return NextResponse.json({ error: 'fornecedor, valor (>0), ano e mes são obrigatórios' }, { status: 400 });
  }
  const competencia = primeiroDiaMes(ano, mes);

  const supabase = getLancadorAdmin();
  const { data, error } = await (supabase.schema('financial' as any) as any)
    .from('bonificacoes')
    .insert({ bar_id: barId, fornecedor, referente, valor, competencia, data_chegada: dataChegada, criado_por: user.email ?? user.nome ?? null })
    .select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (data as any)?.id }, { status: 201 });
}

/** DELETE: exclui 1 bonificação (só se não lançada). Query: ?id= &bar_id=. */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para excluir');
  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const supabase = getLancadorAdmin();
  const { data: bonif } = await (supabase.schema('financial' as any) as any)
    .from('bonificacoes').select('id, ca_lancado').eq('id', id).eq('bar_id', barId).maybeSingle();
  if (!bonif) return NextResponse.json({ error: 'Bonificação não encontrada' }, { status: 404 });
  if ((bonif as any).ca_lancado) return NextResponse.json({ error: 'Já lançada no Conta Azul — não pode excluir (CA não tem DELETE).' }, { status: 409 });

  const { error } = await (supabase.schema('financial' as any) as any).from('bonificacoes').delete().eq('id', id).eq('bar_id', barId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
