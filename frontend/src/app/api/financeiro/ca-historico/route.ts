import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';
import { getLancadorAdmin } from '@/lib/financeiro/contaazul-lancador';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Histórico de tudo que o Zykor lançou no Conta Azul (financial.v_ca_lancamentos_zykor).
 * GET ?bar_id&de&ate&origem — filtra por competência; retorna a lista + resumo por origem.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFinanceiro(user)) return permissionErrorResponse('Sem permissão');
  const url = new URL(request.url);
  const barId = Number(url.searchParams.get('bar_id')) || Number(user.bar_id);
  const origem = url.searchParams.get('origem') || null;
  const hoje = new Date();
  const de = url.searchParams.get('de') || new Date(hoje.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const ate = url.searchParams.get('ate') || hoje.toISOString().slice(0, 10);

  const supabase = getLancadorAdmin();
  const rows = await paginate<any>(() => {
    let q = (supabase.schema('financial' as any) as any)
      .from('v_ca_lancamentos_zykor')
      .select('bar_id, origem, sinal, competencia, descricao, categoria, valor, ca_protocol_id, ca_status, criado_por, quando')
      .eq('bar_id', barId).gte('competencia', de).lte('competencia', ate)
      .order('quando', { ascending: false }).order('ca_protocol_id', { ascending: false });
    if (origem) q = q.eq('origem', origem);
    return q;
  }, { label: 'ca-historico' });

  const resumo: Record<string, { n: number; receita: number; despesa: number }> = {};
  let totalReceita = 0, totalDespesa = 0;
  for (const r of rows) {
    const o = String(r.origem);
    (resumo[o] ||= { n: 0, receita: 0, despesa: 0 });
    resumo[o].n++;
    const v = Number(r.valor || 0);
    if (r.sinal === 'RECEITA') { resumo[o].receita += v; totalReceita += v; }
    else { resumo[o].despesa += v; totalDespesa += v; }
  }
  return NextResponse.json({
    bar_id: barId, de, ate, origem, total: rows.length,
    resumo, total_receita: Math.round(totalReceita * 100) / 100, total_despesa: Math.round(totalDespesa * 100) / 100,
    lancamentos: rows,
  });
}
