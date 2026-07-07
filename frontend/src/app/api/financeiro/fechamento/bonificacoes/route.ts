import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import { getLancadorAdmin, round2, primeiroDiaMes, ultimoDiaMes, mesAnteriorBRT } from '@/lib/financeiro/contaazul-lancador';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CADASTRO DE BONIFICAÇÕES (financial.bonificacoes). Cada bonificação gera um PAR soma-zero no CA:
 * 1 RECEITA (competencia_receita, categoria_receita) + 1 DESPESA (competencia_despesa = dia que
 * chegou, categoria_despesa), mesmo valor. Lançamento em ./lancar.
 *
 *  - GET    : lista as bonificações do mês (por data de chegada) + categorias CA (receita/despesa) pro form.
 *  - POST   : cadastra 1 bonificação.
 *  - DELETE : exclui 1 bonificação (só se ainda não foi lançada no CA).
 */

function anoMesAlvo(url: URL): { ano: number; mes: number } {
  const ano = Number(url.searchParams.get('ano'));
  const mes = Number(url.searchParams.get('mes'));
  if (Number.isFinite(ano) && Number.isFinite(mes) && mes >= 1 && mes <= 12) return { ano, mes };
  return mesAnteriorBRT();
}

async function categoriasCA(barId: number): Promise<{ receita: string[]; despesa: string[] }> {
  const supabase = getLancadorAdmin();
  const { data } = await (supabase.schema('bronze' as any) as any)
    .from('bronze_contaazul_categorias').select('nome, tipo').eq('bar_id', barId).eq('ativo', true).order('nome');
  const rows = (data as any[]) || [];
  return {
    receita: rows.filter((c) => c.tipo === 'RECEITA').map((c) => String(c.nome)),
    despesa: rows.filter((c) => c.tipo === 'DESPESA').map((c) => String(c.nome)),
  };
}

/** GET: lista do mês (por data de chegada) + categorias pro form. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const { ano, mes } = anoMesAlvo(url);
  const de = primeiroDiaMes(ano, mes);
  const ate = ultimoDiaMes(ano, mes);

  const supabase = getLancadorAdmin();
  const { data, error } = await (supabase.schema('financial' as any) as any)
    .from('bonificacoes')
    .select('id, fornecedor, referente, valor, competencia_receita, competencia_despesa, categoria_receita, categoria_despesa, ca_lancado, lancado_em')
    .eq('bar_id', barId).gte('competencia_despesa', de).lte('competencia_despesa', ate)
    .order('competencia_despesa', { ascending: true }).order('id', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bonificacoes = (data as any[]) || [];
  const total = bonificacoes.reduce((s, b) => s + Number(b.valor || 0), 0);
  const total_lancado = bonificacoes.filter((b) => b.ca_lancado).reduce((s, b) => s + Number(b.valor || 0), 0);
  const categorias = await categoriasCA(barId);
  return NextResponse.json({ bar_id: barId, ano, mes, total: round2(total), total_lancado: round2(total_lancado), bonificacoes, categorias });
}

/** POST: cadastra. Body: { bar_id?, fornecedor, valor, referente?, competencia_receita, competencia_despesa, categoria_receita, categoria_despesa }. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão para cadastrar');
  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body?.bar_id) || Number(user.bar_id);
  const fornecedor = String(body?.fornecedor || '').trim();
  const referente = body?.referente != null ? String(body.referente).trim() : null;
  const valor = round2(Number(body?.valor));
  const competenciaReceita = String(body?.competencia_receita || '');
  const competenciaDespesa = String(body?.competencia_despesa || '');
  const categoriaReceita = String(body?.categoria_receita || '').trim();
  const categoriaDespesa = String(body?.categoria_despesa || '').trim();

  const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!barId || !fornecedor || !(valor > 0) || !dateOk(competenciaReceita) || !dateOk(competenciaDespesa) || !categoriaReceita || !categoriaDespesa) {
    return NextResponse.json({ error: 'fornecedor, valor (>0), competências (receita/despesa) e categorias (receita/despesa) são obrigatórios' }, { status: 400 });
  }

  const supabase = getLancadorAdmin();
  const { data, error } = await (supabase.schema('financial' as any) as any)
    .from('bonificacoes')
    .insert({
      bar_id: barId, fornecedor, referente, valor,
      competencia_receita: competenciaReceita, competencia_despesa: competenciaDespesa,
      categoria_receita: categoriaReceita, categoria_despesa: categoriaDespesa,
      criado_por: user.email ?? user.nome ?? null,
    })
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
