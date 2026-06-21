import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { fin, comentarioSistema, formatBRL } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * POST /api/financeiro/cartao/gerar — cria 1 pedido (tipo 'cartao') da fatura inteira,
 * RATEADO por categoria (1 pagamento só). Aprovação → 1 conta a pagar no CA com rateio.
 * Body: { data_vencimento, data_competencia?, descricao?, beneficiario_nome?, linha_digitavel?,
 *         linhas: [{ categoria_id, categoria_nome, valor }] }
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }

  const data_vencimento = String(body.data_vencimento || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
    return NextResponse.json({ success: false, error: 'data_vencimento (AAAA-MM-DD) obrigatória' }, { status: 400 });
  }
  const linhas: Array<{ categoria_id: string; categoria_nome: string; valor: number }> = Array.isArray(body.linhas) ? body.linhas : [];
  if (linhas.length === 0) return NextResponse.json({ success: false, error: 'fatura sem linhas' }, { status: 400 });

  const semCat = linhas.filter(l => !l.categoria_id);
  if (semCat.length) return NextResponse.json({ success: false, error: `${semCat.length} linha(s) sem categoria — categorize tudo antes de gerar` }, { status: 400 });

  // agrega por categoria -> rateio
  const mapa = new Map<string, { id_categoria: string; categoria_nome: string; valor: number }>();
  for (const l of linhas) {
    const v = Math.round(Number(l.valor) * 100) / 100;
    if (!Number.isFinite(v) || v <= 0) continue;
    const cur = mapa.get(l.categoria_id);
    if (cur) cur.valor = Math.round((cur.valor + v) * 100) / 100;
    else mapa.set(l.categoria_id, { id_categoria: l.categoria_id, categoria_nome: l.categoria_nome, valor: v });
  }
  const rateio = Array.from(mapa.values());
  if (rateio.length === 0) return NextResponse.json({ success: false, error: 'valores inválidos' }, { status: 400 });
  const total = Math.round(rateio.reduce((s, r) => s + r.valor, 0) * 100) / 100;
  const principal = rateio.slice().sort((a, b) => b.valor - a.valor)[0];

  const supabase = await getAdminClient();
  const novo = {
    bar_id: user.bar_id,
    tipo: 'cartao',
    status: 'aguardando_aprovacao',
    solicitante_id: user.auth_id,
    solicitante_nome: user.nome,
    descricao: body.descricao?.trim() || `Fatura cartão (${data_vencimento})`,
    valor: total,
    data_competencia: body.data_competencia || data_vencimento,
    data_vencimento,
    beneficiario_nome: body.beneficiario_nome || 'Cartão de crédito',
    linha_digitavel: body.linha_digitavel || null,
    rateio,
    categoria_id: principal.id_categoria,        // categoria principal (rateio carrega o resto)
    categoria_nome: principal.categoria_nome,
    observacao: `Fatura de cartão rateada em ${rateio.length} categoria(s).`,
    criado_por: user.auth_id,
    atualizado_por: user.auth_id,
  };

  const { data, error } = await fin(supabase).from('pedidos_pagamento').insert(novo).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await comentarioSistema(supabase, {
    pedido_id: data.id, bar_id: user.bar_id,
    mensagem: `Fatura de cartão lançada por ${user.nome} — ${formatBRL(total)} em ${rateio.length} categoria(s).`,
  });
  return NextResponse.json({ success: true, pedido: data, total, categorias: rateio.length });
}
