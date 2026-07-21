import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';

const fin = (s: any) => s.schema('financial' as any);

// Normaliza pra 1º dia do mês (YYYY-MM-01) — mesma âncora dos meses das views da DRE.
function competenciaMes(input: { competencia?: string; ano?: number; mes?: number }): string | null {
  if (input.competencia && /^\d{4}-\d{2}-\d{2}$/.test(input.competencia)) {
    return `${input.competencia.slice(0, 7)}-01`;
  }
  const a = Number(input.ano), m = Number(input.mes);
  if (Number.isFinite(a) && Number.isFinite(m) && m >= 1 && m <= 12) {
    return `${a}-${String(m).padStart(2, '0')}-01`;
  }
  return null;
}

// GET /api/financeiro/dre/eventos-outras-receitas?bar_id=&ano=
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const ano = Number(sp.get('ano'));
  if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  let q = fin(supabase).from('dre_eventos_outras_receitas')
    .select('id, bar_id, competencia, descricao, valor, imposto, criado_em')
    .eq('bar_id', barId)
    .order('competencia', { ascending: true });
  if (Number.isFinite(ano)) q = q.gte('competencia', `${ano}-01-01`).lte('competencia', `${ano}-12-31`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outras_receitas: data || [] });
}

// POST — cria uma outra receita (sem CMV) da DRE Eventos
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão financeira');

  let body: any = {};
  try { body = await request.json(); } catch { body = {}; }

  const barId = Number(body.bar_id) || user.bar_id;
  const competencia = competenciaMes(body);
  const valor = Number(body.valor);
  const imposto = Number(body.imposto) || 0;
  if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
  if (!competencia) return NextResponse.json({ error: 'competência (mês/ano) obrigatória' }, { status: 400 });
  if (!Number.isFinite(valor) || valor <= 0) return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
  if (imposto < 0) return NextResponse.json({ error: 'imposto inválido' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await fin(supabase).from('dre_eventos_outras_receitas')
    .insert({
      bar_id: barId,
      competencia,
      descricao: String(body.descricao || '').trim() || null,
      valor: Math.round(valor * 100) / 100,
      imposto: Math.round(imposto * 100) / 100,
      criado_por: user.auth_id,
    })
    .select('id, bar_id, competencia, descricao, valor, imposto, criado_em')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ outra_receita: data });
}

// DELETE /api/financeiro/dre/eventos-outras-receitas?id=&bar_id=
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão financeira');

  const sp = new URL(request.url).searchParams;
  const id = sp.get('id');
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { error } = await fin(supabase).from('dre_eventos_outras_receitas')
    .delete().eq('id', id).eq('bar_id', barId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
