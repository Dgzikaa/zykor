import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import {
  fin,
  podeAprovar,
  registrarHistorico,
  comentarioSistema,
  formatBRL,
  STATUS_AGENDAVEL,
  type PedidoPagamento,
  type PedidoStatus,
  type PedidoCompetencia,
} from '@/lib/financeiro/pedidos-pagamento';
import { broadcastPedidoChange } from '@/lib/realtime/broadcastPedidos';

export const dynamic = 'force-dynamic';

/**
 * POST — AGENDAR (execução) de um pedido já APROVADO. Etapa que efetivamente:
 *  - cria a(s) conta(s) a pagar no Conta Azul;
 *  - agenda o PIX no Inter pro vencimento (pula p/ copia e cola = pagamento manual).
 * Idempotente: retry após erro_ca/erro_inter reusa o que já deu certo. A DECISÃO
 * (categoria/fornecedor/conta) já foi gravada no aprovar; aqui só executa.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeAprovar(user)) return permissionErrorResponse('Apenas o financeiro pode agendar pedidos');
  const { id } = await params;

  let body: any = {};
  try { body = await request.json(); } catch { body = {}; }

  const supabase = await getAdminClient();
  const { data: pedido } = (await fin(supabase)
    .from('pedidos_pagamento')
    .select('*')
    .eq('id', id)
    .maybeSingle()) as { data: PedidoPagamento | null };

  if (!pedido || pedido.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Pedido não encontrado' }, { status: 404 });
  }
  if (!STATUS_AGENDAVEL.includes(pedido.status as PedidoStatus)) {
    return NextResponse.json(
      { success: false, error: `Pedido não pode ser agendado (precisa estar aprovado; status atual: ${pedido.status})` },
      { status: 409 }
    );
  }

  // Permite ajustar o vínculo no agendamento (ex.: corrigir conta/credencial), mas normalmente
  // já veio tudo do aprovar.
  const vinculo: Record<string, unknown> = {};
  for (const c of [
    'categoria_id', 'categoria_nome', 'centro_custo_id', 'centro_custo_nome',
    'contaazul_pessoa_id', 'conta_financeira_id', 'inter_credencial_id',
  ]) {
    if (c in body && body[c] != null && body[c] !== '') vinculo[c] = body[c];
  }
  const p = { ...pedido, ...vinculo } as PedidoPagamento;
  const ehBoleto = !!p.linha_digitavel;
  const ehCopiaCola = !ehBoleto && !!p.pix_copia_cola;

  // Conta pagadora PADRÃO do bar quando não veio nenhuma (credencial deriva dela abaixo).
  if (!p.conta_financeira_id) {
    const { data: cp } = await (supabase.schema('bronze' as any) as any)
      .from('bronze_contaazul_contas_financeiras')
      .select('contaazul_id').eq('bar_id', pedido.bar_id).eq('pagadora_padrao', true).maybeSingle();
    if (cp?.contaazul_id) { p.conta_financeira_id = cp.contaazul_id; vinculo.conta_financeira_id = cp.contaazul_id; }
  }

  // A CONTA PAGADORA manda na credencial Inter — de onde o PIX efetivamente sai.
  if (p.conta_financeira_id && !ehCopiaCola) {
    const { data: contaMap } = await (supabase.schema('bronze' as any) as any)
      .from('bronze_contaazul_contas_financeiras')
      .select('inter_credencial_id')
      .eq('bar_id', pedido.bar_id)
      .eq('contaazul_id', String(p.conta_financeira_id))
      .maybeSingle();
    const cred = Number(contaMap?.inter_credencial_id);
    if (cred && cred !== Number(p.inter_credencial_id)) {
      p.inter_credencial_id = cred;
      vinculo.inter_credencial_id = cred;
    }
  }

  const faltando: string[] = [];
  if (!p.categoria_id) faltando.push('categoria');
  if (!p.conta_financeira_id) faltando.push('conta financeira pagadora');
  if (!p.contaazul_pessoa_id) faltando.push('contato/fornecedor no Conta Azul');
  if (!ehCopiaCola && !p.inter_credencial_id) faltando.push('credencial Inter');
  if (ehBoleto) { if (!p.linha_digitavel) faltando.push('linha digitável'); }
  else if (!ehCopiaCola && !p.chave_pix) faltando.push('chave PIX');
  if (faltando.length) {
    return NextResponse.json({ success: false, error: `Complete antes de agendar: ${faltando.join(', ')}.` }, { status: 400 });
  }

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

  const internalHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const fwdAuth = request.headers.get('authorization');
  const fwdCookie = request.headers.get('cookie');
  const fwdBar = request.headers.get('x-selected-bar-id');
  if (fwdAuth) internalHeaders['authorization'] = fwdAuth;
  if (fwdCookie) internalHeaders['cookie'] = fwdCookie;
  if (fwdBar) internalHeaders['x-selected-bar-id'] = fwdBar;

  const { data: compsData } = await fin(supabase)
    .from('pedidos_pagamento_competencias')
    .select('*')
    .eq('pedido_id', id)
    .order('ordem', { ascending: true });
  const competencias = (compsData || []) as PedidoCompetencia[];

  const criarLancamentoCA = async (args: { data_competencia: string; valor: number; descricao: string; categoria_id?: string | null }): Promise<string> => {
    const r = await fetch(`${origin}/api/financeiro/contaazul/lancamentos`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({
        bar_id: pedido.bar_id,
        data_competencia: args.data_competencia,
        data_vencimento: p.data_vencimento,
        valor: args.valor,
        descricao: args.descricao,
        // #21: categoria por linha (rateio) quando houver; senão a do pedido.
        categoria_id: args.categoria_id || p.categoria_id,
        centro_custo_id: p.centro_custo_id || undefined,
        conta_financeira_id: p.conta_financeira_id,
        pessoa_id: p.contaazul_pessoa_id,
        cpf_cnpj: p.cpf_cnpj || undefined,
        nome_beneficiario: p.beneficiario_nome || undefined,
        rateio: p.rateio || undefined,
      }),
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d?.error || `Conta Azul HTTP ${r.status}`);
    return d.contaazul_id;
  };

  // ---------- CLAIM ATÔMICO (anti-duplicação) ----------
  // Bug 14/07: dois cliques/retentativas simultâneos passavam o check de status juntos e cada um
  // criava um lançamento no Conta Azul → duplicata (a trava anti-dup do CA só enxerga após o sync).
  // Aqui o pedido é "reivindicado" com um UPDATE condicional: vira 'agendando' e SÓ a requisição
  // que conseguir o UPDATE segue; as concorrentes tomam 409. Recuperação de crash: um 'agendando'
  // preso há > 3 min volta a ser agendável antes do claim.
  const staleISO = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await fin(supabase)
    .from('pedidos_pagamento')
    .update({ status: 'erro_inter', erro_mensagem: 'Agendamento anterior não concluiu — destravado para nova tentativa.' })
    .eq('id', id).eq('status', 'agendando').lt('updated_at', staleISO);
  const { data: claimed } = await fin(supabase)
    .from('pedidos_pagamento')
    .update({ status: 'agendando', atualizado_por: user.auth_id, updated_at: new Date().toISOString() })
    .eq('id', id).in('status', STATUS_AGENDAVEL as unknown as string[]).select('id');
  if (!claimed?.length) {
    return NextResponse.json(
      { success: false, error: 'Este pedido já está sendo agendado (ou já foi). Aguarde alguns segundos e recarregue a lista.' },
      { status: 409 },
    );
  }

  // ---------- Etapa 1: BANCO (Inter) primeiro — boleto/PIX ----------
  // REGRA (pedido do Gonza, 10/07): o Conta Azul só é criado DEPOIS que o banco aceitar.
  // Antes a ordem era CA→Inter: quando o boleto falhava no Inter, o lançamento no CA já
  // tinha sido criado; a cada retentativa empilhava outro no CA (o protocolId 202 às vezes
  // vinha nulo, furando a idempotência, e o anti-dup do CA só pega após o sync). Invertendo,
  // se o banco falha nada é tocado no CA. Idempotente via inter_codigo_solicitacao.
  // (pula p/ copia e cola = pagamento manual, que não passa pelo banco).
  let interCodigo = p.inter_codigo_solicitacao || null;
  if (!ehCopiaCola && !interCodigo) {
    try {
      const r = await fetch(`${origin}/api/financeiro/inter/${ehBoleto ? 'boleto' : 'pix'}`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          valor: p.valor,
          descricao: p.descricao,
          destinatario: p.beneficiario_nome || p.solicitante_nome || 'Beneficiário',
          ...(ehBoleto ? { linha_digitavel: p.linha_digitavel, data_vencimento: p.data_vencimento } : { chave: p.chave_pix }),
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
      if (!interCodigo) {
        const msg = 'Inter não retornou codigoSolicitacao';
        await marcarErro(supabase, id, pedido.bar_id, 'erro_inter', msg, user);
        return NextResponse.json({ success: false, etapa: 'inter', error: msg }, { status: 502 });
      }
      await fin(supabase).from('pedidos_pagamento').update({ inter_codigo_solicitacao: interCodigo }).eq('id', id);
    } catch (e: any) {
      const msg = e?.message || 'Falha de rede ao enviar PIX';
      await marcarErro(supabase, id, pedido.bar_id, 'erro_inter', msg, user);
      return NextResponse.json({ success: false, etapa: 'inter', error: msg }, { status: 500 });
    }
  }

  // ---------- Etapa 2: Conta(s) a pagar no Conta Azul (só chega aqui com o banco OK) ----------
  let contaazulLancamentoId = p.contaazul_lancamento_id || null;
  if (competencias.length > 0) {
    for (const comp of competencias) {
      if (comp.contaazul_lancamento_id) continue;
      const desc = comp.descricao
        ? `${p.descricao} — ${comp.descricao}`
        : `${p.descricao} (comp. ${comp.data_competencia})`;
      try {
        const caId = await criarLancamentoCA({ data_competencia: comp.data_competencia, valor: comp.valor, descricao: desc, categoria_id: (comp as any).categoria_id || null });
        await fin(supabase).from('pedidos_pagamento_competencias').update({ contaazul_lancamento_id: caId }).eq('id', comp.id);
        comp.contaazul_lancamento_id = caId;
      } catch (e: any) {
        const msg = `competência ${comp.data_competencia}: ${e?.message || 'falha no Conta Azul'}`;
        await marcarErro(supabase, id, pedido.bar_id, 'erro_ca', msg, user);
        return NextResponse.json({ success: false, etapa: 'ca', error: msg }, { status: 400 });
      }
    }
    if (!contaazulLancamentoId && competencias[0]?.contaazul_lancamento_id) {
      contaazulLancamentoId = competencias[0].contaazul_lancamento_id;
      await fin(supabase).from('pedidos_pagamento').update({ contaazul_lancamento_id: contaazulLancamentoId }).eq('id', id);
    }
  } else if (!contaazulLancamentoId) {
    try {
      contaazulLancamentoId = await criarLancamentoCA({ data_competencia: competencia, valor: p.valor, descricao: p.descricao });
      await fin(supabase).from('pedidos_pagamento').update({ contaazul_lancamento_id: contaazulLancamentoId }).eq('id', id);
    } catch (e: any) {
      const msg = e?.message || 'Falha de rede ao criar no Conta Azul';
      await marcarErro(supabase, id, pedido.bar_id, 'erro_ca', msg, user);
      return NextResponse.json({ success: false, etapa: 'ca', error: msg }, { status: 500 });
    }
  }

  // Copia e cola continua 'aprovado' (pagamento manual); os demais viram 'agendado'.
  const statusFinal = ehCopiaCola ? 'aprovado' : 'agendado';
  const { data: atualizado } = await fin(supabase)
    .from('pedidos_pagamento')
    .update({
      status: statusFinal,
      inter_codigo_solicitacao: interCodigo,
      erro_mensagem: null,
      atualizado_por: user.auth_id,
    })
    .eq('id', id)
    .select()
    .single();

  // Memoriza conta pagadora + Inter como padrão do bar.
  if (p.conta_financeira_id && p.inter_credencial_id) {
    await fin(supabase).from('pagamento_config_bar').upsert({
      bar_id: pedido.bar_id,
      conta_financeira_id: p.conta_financeira_id,
      inter_credencial_id: Number(p.inter_credencial_id),
      atualizado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id' });
  }

  await registrarHistorico(supabase, {
    pedido_id: id, bar_id: pedido.bar_id, autor: user, campo: 'status',
    valor_anterior: pedido.status, valor_novo: statusFinal,
  });
  const hojeISO = new Date().toISOString().slice(0, 10);
  const ehAgendado = !!p.data_vencimento && /^\d{4}-\d{2}-\d{2}$/.test(p.data_vencimento) && p.data_vencimento > hojeISO;
  const contaTxt = competencias.length
    ? `${competencias.length} contas a pagar criadas no Conta Azul (uma por competência)`
    : 'Conta a pagar criada no Conta Azul';
  const mensagem = ehCopiaCola
    ? `Agendado por ${user.nome}. ${contaTxt}. Pagamento por PIX copia e cola de ${formatBRL(p.valor)} é MANUAL: cole o código no app do Inter e marque como pago.`
    : `Agendado por ${user.nome}. ${contaTxt} e PIX de ${formatBRL(p.valor)} ${
        ehAgendado ? `agendado no Inter para ${p.data_vencimento}` : 'enviado no Inter para pagamento imediato'
      }. Falta o OK final do sócio no app do Inter.`;
  await comentarioSistema(supabase, { pedido_id: id, bar_id: pedido.bar_id, mensagem });

  await broadcastPedidoChange(pedido.bar_id);
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
    mensagem: `Falha na ${status === 'erro_ca' ? 'criação no Conta Azul' : 'emissão do pagamento no Inter'}: ${mensagem}`,
  });
}
