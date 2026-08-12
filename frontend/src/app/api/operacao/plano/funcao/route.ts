import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

// =====================================================
// PATCH /api/operacao/plano/funcao
// body: { data, turno, funcao_id, total_manual?, fixos_manual? }
//
// Override de UMA célula. Mandar null limpa o override e a célula volta ao automático
// (verde) — é o "desfazer" da edição manual, sem precisar saber qual era o valor antes.
// O total_calculado e o fixos_escala NUNCA são tocados aqui: eles são o automático.
// =====================================================
export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const data = String(body.data || '');
  const turno = ['unico', 'dia', 'noite'].includes(body.turno) ? body.turno : 'unico';
  const funcaoId = String(body.funcao_id || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !funcaoId) {
    return NextResponse.json({ error: 'Informe data, turno e funcao_id' }, { status: 400 });
  }

  const c = sb();

  // o dia tem que ser do bar do usuário — nunca confiar no id que veio do cliente
  const { data: dia } = await ops(c).from('operacao_dia').select('id')
    .eq('bar_id', user.bar_id).eq('data', data).eq('turno', turno).maybeSingle();
  if (!dia) return NextResponse.json({ error: 'Dia não encontrado — preencha o faturamento primeiro' }, { status: 404 });

  const { data: funcao } = await ops(c).from('operacao_funcao').select('id')
    .eq('bar_id', user.bar_id).eq('id', funcaoId).maybeSingle();
  if (!funcao) return NextResponse.json({ error: 'Função não encontrada neste bar' }, { status: 404 });

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const campo of ['total_manual', 'fixos_manual']) {
    if (campo in body) {
      const v = body[campo];
      patch[campo] = v === null || v === '' ? null : Math.max(0, Math.round(Number(v)));
    }
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  const { error } = await ops(c).from('operacao_dia_funcao')
    .upsert({ operacao_dia_id: dia.id, funcao_id: funcaoId, ...patch }, { onConflict: 'operacao_dia_id,funcao_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // devolve a linha já resolvida (total/fixos/freelas/custo) pela view
  const { data: linha } = await ops(c).from('v_operacao_dia_funcao').select('*')
    .eq('operacao_dia_id', dia.id).eq('funcao_id', funcaoId).maybeSingle();

  return NextResponse.json({ linha });
}
