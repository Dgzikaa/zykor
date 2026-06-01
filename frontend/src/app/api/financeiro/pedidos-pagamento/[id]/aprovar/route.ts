import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin,
  podeAprovar,
  registrarHistorico,
  comentarioSistema,
  formatBRL,
  STATUS_APROVAVEL,
  type PedidoPagamento,
  type PedidoStatus,
} from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * POST — Aprovar pedido. Idempotente:
 *  - se ainda não criou no Conta Azul, cria a conta a pagar;
 *  - se ainda não disparou no Inter, agenda o PIX pro vencimento.
 * Retry após erro_ca/erro_inter reusa o que já deu certo.
 *
 * O financeiro completa o vínculo CA no corpo da aprovação:
 *   categoria_id, conta_financeira_id, contaazul_pessoa_id, inter_credencial_id
 *   (+ opcionais centro_custo_id/nome, categoria_nome).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAprovar(user)) return permissionErrorResponse('Apenas o financeiro pode aprovar pedidos');
  const { id } = await params;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supabase = await getAdminClient();
  const { data: pedido } = (await fin(supabase)
    .from('pedidos_pagamento')
    .select('*')
    .eq('id', id)
    .maybeSingle()) as { data: PedidoPagamento | null };

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }
  if (!STATUS_APROVAVEL.includes(pedido.status as PedidoStatus)) {
    return NextResponse.json(
      { success: false, error: `Pedido não pode ser aprovado (status atual: ${pedido.status})` },
      { status: 409 }
    );
  }

  // Mescla os campos de vínculo CA enviados na aprovação.
  const vinculo: Record<string, unknown> = {};
  for (const c of [
    'categoria_id', 'categoria_nome', 'centro_custo_id', 'centro_custo_nome',
    'contaazul_pessoa_id', 'conta_financeira_id', 'inter_credencial_id',
  ]) {
    if (c in body && body[c] != null && body[c] !== '') vinculo[c] = body[c];
  }
  const p = { ...pedido, ...vinculo } as PedidoPagamento;

  // Validação do que o CA/Inter exigem.
  const faltando: string[] = [];
  if (!p.categoria_id) faltando.push('categoria');
  if (!p.conta_financeira_id) faltando.push('conta financeira pagadora');
  if (!p.contaazul_pessoa_id) faltando.push('contato/fornecedor no Conta Azul');
  if (!p.inter_credencial_id) faltando.push('credencial Inter');
  if (!p.chave_pix) faltando.push('chave PIX');
  if (faltando.length) {
    return NextResponse.json(
      { success: false, error: `Complete antes de aprovar: ${faltando.join(', ')}.` },
      { status: 400 }
    );
  }

  // Persiste o vínculo + carimbo de aprovação (status provisório enquanto processa).
  if (Object.keys(vinculo).length) {
    await fin(supabase).from('pedidos_pagamento').update(vinculo).eq('id', id);
    for (const [campo, valor] of Object.entries(vinculo)) {
      await registrarHistorico(supabase, {
        pedido_id: id, bar_id: pedido.bar_id, autor: user, campo,
        valor_anterior: (pedido as any)[campo], valor_novo: valor,
      });
    }
  }

  const origin = new URL(request.url).origin;
  const competencia = p.data_competencia || p.data_vencimento;

  // Repassa a identidade do aprovador pras chamadas internas (que agora exigem auth).
  // Sem isso, a aprovação bateria 401 nos endpoints de PIX/Conta Azul.
  const internalHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const fwdAuth = request.headers.get('authorization');
  const fwdCookie = request.headers.get('cookie');
  const fwdBar = request.headers.get('x-selected-bar-id');
  if (fwdAuth) internalHeaders['authorization'] = fwdAuth;
  if (fwdCookie) internalHeaders['cookie'] = fwdCookie;
  if (fwdBar) internalHeaders['x-selected-bar-id'] = fwdBar;

  // ---------- Etapa 1: Conta a pagar no Conta Azul (pula se já criada) ----------
  let contaazulLancamentoId = p.contaazul_lancamento_id || null;
  if (!contaazulLancamentoId) {
    try {
      const r = await fetch(`${origin}/api/financeiro/contaazul/lancamentos`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          bar_id: pedido.bar_id,
          data_competencia: competencia,
          data_vencimento: p.data_vencimento,
          valor: p.valor,
          descricao: p.descricao,
          categoria_id: p.categoria_id,
          centro_custo_id: p.centro_custo_id || undefined,
          conta_financeira_id: p.conta_financeira_id,
          pessoa_id: p.contaazul_pessoa_id,
          cpf_cnpj: p.cpf_cnpj || undefined,
          nome_beneficiario: p.beneficiario_nome || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const msg = d?.error || `Conta Azul HTTP ${r.status}`;
        await marcarErro(supabase, id, pedido.bar_id, 'erro_ca', msg, user);
        return NextResponse.json({ success: false, etapa: 'ca', error: msg }, { status: 400 });
      }
      contaazulLancamentoId = d.contaazul_id;
      await fin(supabase).from('pedidos_pagamento').update({ contaazul_lancamento_id: contaazulLancamentoId }).eq('id', id);
    } catch (e: any) {
      const msg = e?.message || 'Falha de rede ao criar no Conta Azul';
      await marcarErro(supabase, id, pedido.bar_id, 'erro_ca', msg, user);
      return NextResponse.json({ success: false, etapa: 'ca', error: msg }, { status: 500 });
    }
  }

  // ---------- Etapa 2: Agendar PIX no Inter (pula se já disparado) ----------
  let interCodigo = p.inter_codigo_solicitacao || null;
  if (!interCodigo) {
    try {
      const r = await fetch(`${origin}/api/financeiro/inter/pix`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          valor: p.valor,
          descricao: p.descricao,
          destinatario: p.beneficiario_nome || p.solicitante_nome || 'Beneficiário',
          chave: p.chave_pix,
          data_pagamento: p.data_vencimento,
          bar_id: pedido.bar_id,
          inter_credencial_id: Number(p.inter_credencial_id),
          agendamento_id: id,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        const msg = d?.error || `Inter HTTP ${r.status}`;
        await marcarErro(supabase, id, pedido.bar_id, 'erro_inter', msg, user);
        return NextResponse.json({ success: false, etapa: 'inter', error: msg }, { status: 400 });
      }
      interCodigo = d.data?.codigoSolicitacao || '';
    } catch (e: any) {
      const msg = e?.message || 'Falha de rede ao enviar PIX';
      await marcarErro(supabase, id, pedido.bar_id, 'erro_inter', msg, user);
      return NextResponse.json({ success: false, etapa: 'inter', error: msg }, { status: 500 });
    }
  }

  // ---------- Sucesso: agendado (sócio dá o OK final no app do Inter) ----------
  const { data: atualizado } = await fin(supabase)
    .from('pedidos_pagamento')
    .update({
      status: 'agendado',
      inter_codigo_solicitacao: interCodigo,
      erro_mensagem: null,
      aprovado_por_id: user.auth_id,
      aprovado_por_nome: user.nome,
      aprovado_em: new Date().toISOString(),
      atualizado_por: user.auth_id,
    })
    .eq('id', id)
    .select()
    .single();

  await registrarHistorico(supabase, {
    pedido_id: id, bar_id: pedido.bar_id, autor: user, campo: 'status',
    valor_anterior: pedido.status, valor_novo: 'agendado',
  });
  await comentarioSistema(supabase, {
    pedido_id: id, bar_id: pedido.bar_id,
    mensagem: `Aprovado por ${user.nome}. Conta a pagar criada no Conta Azul e PIX de ${formatBRL(p.valor)} agendado no Inter para ${p.data_vencimento}. Falta o OK final do sócio no app do Inter.`,
  });

  return NextResponse.json({ success: true, pedido: atualizado });
}

async function marcarErro(
  supabase: any, id: string, bar_id: number,
  status: 'erro_ca' | 'erro_inter', mensagem: string, user: any
) {
  await fin(supabase)
    .from('pedidos_pagamento')
    .update({ status, erro_mensagem: mensagem, atualizado_por: user.auth_id })
    .eq('id', id);
  await comentarioSistema(supabase, {
    pedido_id: id, bar_id,
    mensagem: `Falha na ${status === 'erro_ca' ? 'criação no Conta Azul' : 'emissão do PIX no Inter'}: ${mensagem}`,
  });
}
