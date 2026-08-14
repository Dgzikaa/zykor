import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Histórico de freelas do ano (ata de RH de 13/08/2026).
 *
 * A fonte é o fluxo de pagamento (`financial.pedidos_pagamento` tipo='freela'), não a tela de
 * convocação de `hr.freela_convocacao` — essa nunca foi usada e está zerada. Quem pagou, pagou
 * por diária, e é a diária que conta.
 */

/** GET ?ano=2026&chave_pix= (detalhe de uma pessoa) */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const ano = Number(sp.get('ano')) || new Date().getFullYear();
  const chavePix = sp.get('chave_pix');

  const supabase = await getAdminClient();

  // detalhe: as diárias de uma pessoa, para conferir de onde vem o número
  if (chavePix) {
    const { data: pedidos, error } = await (supabase as any).schema('financial').from('pedidos_pagamento')
      .select('id, status, valor, data_competencia, descricao, pedidos_pagamento_competencias(data_competencia, valor, descricao)')
      .eq('bar_id', user.bar_id).eq('tipo', 'freela').eq('chave_pix', chavePix)
      .in('status', ['aguardando_aprovacao', 'aprovado', 'agendado', 'pago']);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const diarias: any[] = [];
    for (const p of pedidos || []) {
      const comps = p.pedidos_pagamento_competencias || [];
      // pedido antigo (antes do modelo de competências) é ele mesmo uma diária
      if (comps.length === 0) diarias.push({ dia: p.data_competencia, valor: Number(p.valor || 0), funcao: p.descricao, status: p.status });
      else for (const c of comps) diarias.push({ dia: c.data_competencia, valor: Number(c.valor || 0), funcao: c.descricao, status: p.status });
    }
    diarias.sort((a, b) => String(b.dia).localeCompare(String(a.dia)));
    return NextResponse.json({ success: true, diarias: diarias.filter((d) => String(d.dia).startsWith(String(ano))) });
  }

  const { data, error } = await (supabase as any).schema('hr')
    .rpc('fn_freelas_historico', { p_bar_id: user.bar_id, p_ano: ano });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = (data || []).map((l: any) => ({
    ...l,
    total_pago: Number(l.total_pago || 0),
    total_previsto: Number(l.total_previsto || 0),
    // pessoa física com pelo menos uma semana acima de 2 diárias — o que a ata chamou de risco
    risco: !l.eh_empresa && Number(l.semanas_risco || 0) > 0,
  }));

  const pessoas = linhas.filter((l: any) => !l.eh_empresa);
  return NextResponse.json({
    success: true,
    ano,
    linhas,
    resumo: {
      pessoas: pessoas.length,
      diarias: pessoas.reduce((s: number, l: any) => s + l.diarias, 0),
      total_pago: linhas.reduce((s: number, l: any) => s + l.total_pago, 0),
      em_risco: linhas.filter((l: any) => l.risco).length,
    },
  });
}
