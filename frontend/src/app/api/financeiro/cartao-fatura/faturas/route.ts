import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

// GET — faturas do bar. ?status=aberta|encerrada (default aberta). Traz o cartão embutido
//   + total lançável (soma das compras) e quanto já foi lançado no CA.
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'ver')) return permissionErrorResponse('Sem permissão');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const status = new URL(request.url).searchParams.get('status') || 'aberta';
  const supabase = await getAdminClient();
  const { data: faturas, error } = await fin(supabase)
    .from('cartao_faturas')
    .select('*, cartao:cartao_cadastro(id,banco,tipo,dono)')
    .eq('bar_id', user.bar_id).eq('status', status)
    .order('vencimento', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Totais por fatura (compras) + lançados.
  const ids = (faturas || []).map((f: any) => f.id);
  const totais: Record<string, { total: number; lancado: number; novos: number }> = {};
  if (ids.length) {
    const { data: linhas } = await fin(supabase)
      .from('cartao_fatura_linhas').select('fatura_id, valor, tipo, status').in('fatura_id', ids);
    for (const l of (linhas || []) as any[]) {
      if (l.tipo !== 'compra') continue;
      const t = (totais[l.fatura_id] ||= { total: 0, lancado: 0, novos: 0 });
      t.total += Number(l.valor) || 0;
      if (l.status === 'lancado') t.lancado += Number(l.valor) || 0;
      else if (l.status === 'novo') t.novos += 1;
    }
  }
  const out = (faturas || []).map((f: any) => ({ ...f, totais: totais[f.id] || { total: 0, lancado: 0, novos: 0 } }));
  return NextResponse.json({ success: true, faturas: out });
}

// POST — cria uma fatura { cartao_id, vencimento, valor_informado? }.
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'inserir')) return permissionErrorResponse('Sem permissão');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const cartao_id = String(body.cartao_id || '');
  const vencimento = String(body.vencimento || '');
  if (!cartao_id) return NextResponse.json({ success: false, error: 'selecione o cartão' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) return NextResponse.json({ success: false, error: 'vencimento (AAAA-MM-DD) obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const valor_informado = Number(body.valor_informado);
  const { data, error } = await fin(supabase).from('cartao_faturas').insert({
    bar_id: user.bar_id, cartao_id, vencimento,
    valor_informado: Number.isFinite(valor_informado) && valor_informado > 0 ? valor_informado : null,
    criado_por: user.auth_id,
  }).select('*, cartao:cartao_cadastro(id,banco,tipo,dono)').single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, fatura: data });
}
