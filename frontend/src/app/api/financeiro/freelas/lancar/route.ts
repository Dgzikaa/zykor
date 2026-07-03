import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { fin, comentarioSistema, formatBRL } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * Lança um LOTE de pagamentos de freela (entrada direta, sem planilha).
 * POST /api/financeiro/freelas/lancar
 *   { data_vencimento: 'AAAA-MM-DD', data_competencia?: 'AAAA-MM-DD',
 *     itens: [{ freela_id, valor }] }
 * Gera 1 pedido_pagamento (tipo='freela', aguardando_aprovacao) por item, usando os
 * dados salvos do freela (PIX, CPF, categoria, pessoa do CA). O financeiro aprova em
 * lote → o motor existente dispara Inter PIX + conta a pagar no Conta Azul.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }

  const data_vencimento = String(body.data_vencimento || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
    return NextResponse.json({ success: false, error: 'data_vencimento (AAAA-MM-DD) obrigatória' }, { status: 400 });
  }
  const itens: Array<{ freela_id: string; valor: number }> = Array.isArray(body.itens) ? body.itens : [];
  if (itens.length === 0) return NextResponse.json({ success: false, error: 'nenhum freela no lote' }, { status: 400 });

  const supabase = await getAdminClient();
  // Carrega os freelas do lote (escopados ao bar)
  const ids = itens.map(i => i.freela_id);
  const { data: freelas, error: errFre } = await fin(supabase)
    .from('beneficiarios').select('*').eq('bar_id', user.bar_id).in('id', ids);
  if (errFre) return NextResponse.json({ success: false, error: errFre.message }, { status: 500 });
  const mapa = new Map((freelas || []).map((f: any) => [f.id, f]));

  const data_competencia = body.data_competencia || data_vencimento;
  const novos: any[] = [];
  const erros: string[] = [];
  for (const it of itens) {
    const f: any = mapa.get(it.freela_id);
    if (!f) { erros.push(`freela ${it.freela_id} não encontrado`); continue; }
    const valor = Math.round(Number(it.valor) * 100) / 100;
    if (!Number.isFinite(valor) || valor <= 0) { erros.push(`valor inválido para ${f.nome}`); continue; }
    novos.push({
      bar_id: user.bar_id,
      tipo: 'freela',
      status: 'aguardando_aprovacao',
      solicitante_id: user.auth_id,
      solicitante_nome: user.nome,
      descricao: `Freela ${f.funcao ? f.funcao + ' — ' : ''}${f.nome} (${data_vencimento})`,
      valor,
      data_competencia,
      data_vencimento,
      beneficiario_nome: f.nome,
      chave_pix: f.chave_pix,
      tipo_chave: f.tipo_chave,
      cpf_cnpj: f.cpf_cnpj,
      categoria_id: f.categoria_id,
      categoria_nome: f.categoria_nome,
      contaazul_pessoa_id: f.contaazul_pessoa_id,
      criado_por: user.auth_id,
      atualizado_por: user.auth_id,
    });
  }
  if (novos.length === 0) {
    return NextResponse.json({ success: false, error: 'nada a lançar', detalhes: erros }, { status: 400 });
  }

  const { data: criados, error } = await fin(supabase).from('pedidos_pagamento').insert(novos).select();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Comentário de sistema em cada pedido (rastreabilidade)
  for (const p of criados || []) {
    await comentarioSistema(supabase, {
      pedido_id: p.id, bar_id: user.bar_id,
      mensagem: `Freela lançado em lote por ${user.nome} — ${formatBRL(p.valor)}.`,
    });
  }

  const total = (criados || []).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
  return NextResponse.json({ success: true, criados: (criados || []).length, total, erros, pedidos: criados });
}
