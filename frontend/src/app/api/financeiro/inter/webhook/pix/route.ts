import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const WEBHOOK_TOKEN = process.env.INTER_WEBHOOK_TOKEN || ''; // shared secret opcional

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Webhook Inter PIX
 *
 * O Inter chama esse endpoint quando o status de uma solicitação PIX muda
 * (PIX agendado executado, falhou, cancelado, aprovado, etc).
 *
 * URL pública (registrada em /banking/v2/pix/webhook):
 *   https://zykor.com.br/api/financeiro/inter/webhook/pix
 *
 * Validação:
 *   - Aceita query param `?token=<INTER_WEBHOOK_TOKEN>` se a env var estiver setada
 *   - Caso contrário, aceita qualquer chamada (mas sempre loga em inter_webhook_logs)
 *   - Inter não assina com HMAC, mas faz mTLS com cert/key cadastrados no portal — nem
 *     toda hospedagem aceita validar o cert client-side, então o token compartilhado
 *     na URL é o mecanismo prático.
 *
 * Idempotência:
 *   - O update em pix_enviados é por inter_codigo_solicitacao (UPSERT-style com find/update),
 *     então receber o mesmo evento 2x não causa estado errado.
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const ipOrigem =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;

  // Validação do token compartilhado. HARDENING OPT-IN: se INTER_WEBHOOK_TOKEN
  // estiver setada no Vercel, exige ?token=<valor> e rejeita o resto (fecha o forge
  // de status). Enquanto a env NÃO estiver setada, aceita (pra não derrubar a
  // reconciliação de PIX). Pra ativar: setar a env + re-registrar o webhook no Inter
  // com a URL contendo ?token=<valor>.
  if (WEBHOOK_TOKEN) {
    const tokenRecebido = request.nextUrl.searchParams.get('token');
    if (tokenRecebido !== WEBHOOK_TOKEN) {
      console.warn('[INTER-WEBHOOK] Token inválido ou ausente. IP:', ipOrigem);
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[INTER-WEBHOOK] INTER_WEBHOOK_TOKEN não configurada — aceitando sem auth (configure pra ativar o hardening).');
  }

  let payload: any = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  // Headers úteis pra audit
  const headersObj: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    if (
      [
        'user-agent',
        'content-type',
        'x-forwarded-for',
        'x-real-ip',
        'x-inter-event',
        'x-inter-signature',
      ].includes(k.toLowerCase())
    ) {
      headersObj[k] = v;
    }
  });

  // Inter PIX webhook payload típico (estimado — varia por evento):
  // { codigoSolicitacao, status, dataPagamento, contaCorrente, ... }
  // Pode ser um array de eventos também.
  const events: any[] = Array.isArray(payload) ? payload : payload ? [payload] : [];

  // 1) Log bruto de cada evento recebido
  const logRows = events.map(ev => ({
    bar_id: null as number | null,
    inter_credencial_id: null as number | null,
    tipo_evento: ev?.tipo || ev?.evento || ev?.eventType || null,
    codigo_solicitacao:
      ev?.codigoSolicitacao || ev?.codigo_solicitacao || ev?.txId || ev?.txid || null,
    status: ev?.status || ev?.statusCode || null,
    ip_origem: ipOrigem,
    headers: headersObj,
    payload: ev,
    processado: false,
  }));

  if (logRows.length > 0) {
    const { error: logErr } = await (supabase
      .schema('financial' as any) as any)
      .from('inter_webhook_logs')
      .insert(logRows);
    if (logErr) {
      console.error('[INTER-WEBHOOK] Erro ao logar:', logErr);
    }
  }

  // 2) Processar cada evento — atualiza pix_enviados pelo codigo_solicitacao
  let processados = 0;
  for (const ev of events) {
    const codigo =
      ev?.codigoSolicitacao || ev?.codigo_solicitacao || ev?.txId || ev?.txid;
    const novoStatus = ev?.status || ev?.statusCode;
    // Bloqueia injeção de filtro PostgREST no .or() abaixo: o código deve ser
    // alfanumérico/UUID (sem vírgula, ponto ou parênteses que alterariam o filtro).
    if (!codigo || !/^[A-Za-z0-9_-]+$/.test(String(codigo))) continue;

    const { data: existing } = await (supabase
      .schema('financial' as any) as any)
      .from('pix_enviados')
      .select('id, status, inter_status, pagamento_zykor_id')
      .or(`inter_codigo_solicitacao.eq.${codigo},txid.eq.${codigo}`)
      .limit(1)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      inter_status: novoStatus || null,
      last_webhook_at: new Date().toISOString(),
      last_webhook_payload: ev,
    };

    // Mapeia status Inter → status local do pix_enviados.
    // ATENÇÃO: o Inter manda EFETIVADO (não "EXECUTADO"/"PAGO") quando o pagamento sai —
    // faltava na lista e a virada pra 'pago' não disparava. REPROVADO = sócio recusou no app.
    const statusUpper = String(novoStatus || '').toUpperCase();
    if (['EFETIVADO', 'EXECUTADO', 'CONCLUIDO', 'PAGO', 'COMPLETED'].includes(statusUpper)) {
      updates.status = 'pago';
    } else if (['FALHOU', 'ERRO', 'FAILED', 'REPROVADO', 'REJEITADO'].includes(statusUpper)) {
      updates.status = 'erro';
    } else if (['CANCELADO', 'CANCELLED'].includes(statusUpper)) {
      updates.status = 'cancelado';
    } else if (['AGENDADO', 'SCHEDULED', 'ENVIADO', 'AGUARDANDO_APROVACAO', 'PENDING'].includes(statusUpper)) {
      updates.status = 'agendado';
    }

    if (existing?.id) {
      const { error: upErr } = await (supabase
        .schema('financial' as any) as any)
        .from('pix_enviados')
        .update(updates)
        .eq('id', existing.id);
      if (!upErr) processados += 1;
      else console.error('[INTER-WEBHOOK] Erro update pix_enviados:', upErr);
    } else {
      // Não temos esse PIX local — registra como entrada não correlata
      console.warn('[INTER-WEBHOOK] Codigo desconhecido:', codigo, 'status:', novoStatus);
    }

    // PROPAGA pro PEDIDO o CICLO REAL do Inter (não só "pago"). O pedido acompanha o estado do
    // sócio no app do Inter, movendo AUTOMÁTICO entre as abas:
    //   ENVIADO/aguardando → 'aguardando_socio' (aba Aprovado, laranja) — subido, espera o sócio
    //   AGENDADO           → 'agendado'         (aba Finalizado) — sócio aprovou, aguarda a data
    //   EFETIVADO/pago     → 'pago'             (aba Finalizado) — efetivou
    //   REPROVADO          → 'reprovado'        (aba Finalizado) — sócio recusou (registro)
    // Liga pelo código do Inter (o pedido guarda inter_codigo_solicitacao) ou pelo id
    // (pix_enviados.pagamento_zykor_id). Só avança o fluxo — nunca regride nem toca em terminais
    // (pago/rejeitado/cancelado). Best-effort: falha aqui é logada e NÃO derruba o webhook (o Inter
    // espera 200). Copia-e-cola/manual não passa pelo Inter → fecha pelo botão "Marcar como pago".
    const alvoPedido =
      updates.status === 'pago' ? 'pago'
      : statusUpper === 'REPROVADO' ? 'reprovado'
      : ['AGENDADO', 'SCHEDULED'].includes(statusUpper) ? 'agendado'
      : ['ENVIADO', 'AGUARDANDO_APROVACAO', 'PENDING'].includes(statusUpper) ? 'aguardando_socio'
      : ['FALHOU', 'ERRO', 'FAILED'].includes(statusUpper) ? 'erro_inter'
      : null;
    if (alvoPedido) {
      try {
        const fin2 = (supabase.schema('financial' as any) as any);
        let ped: any = null;
        const q1 = await fin2.from('pedidos_pagamento')
          .select('id, bar_id, status')
          .eq('inter_codigo_solicitacao', String(codigo))
          .limit(1).maybeSingle();
        ped = q1.data;
        if (!ped && existing?.pagamento_zykor_id) {
          const q2 = await fin2.from('pedidos_pagamento')
            .select('id, bar_id, status')
            .eq('id', existing.pagamento_zykor_id)
            .limit(1).maybeSingle();
          ped = q2.data;
        }
        // Não mexe em quem já está no estado-alvo nem em terminais (pago sempre pode fechar).
        const TERMINAIS = ['pago', 'rejeitado', 'cancelado'];
        const podeAtualizar = ped && ped.status !== alvoPedido &&
          (alvoPedido === 'pago' ? ped.status !== 'pago' : !TERMINAIS.includes(ped.status));
        if (podeAtualizar) {
          await fin2.from('pedidos_pagamento')
            .update({
              status: alvoPedido,
              ...(alvoPedido === 'pago' ? { pago_em: new Date().toISOString() } : {}),
            })
            .eq('id', ped.id);
          const MSG: Record<string, string> = {
            pago: 'Pagamento confirmado automaticamente pelo Inter (webhook PIX).',
            agendado: 'Aprovado pelo sócio no Inter — agendado, aguardando a data (webhook PIX).',
            aguardando_socio: 'Enviado ao Inter — aguardando a aprovação do sócio no app (webhook PIX).',
            reprovado: 'Recusado pelo sócio no app do Inter (webhook PIX).',
            erro_inter: 'Falha reportada pelo Inter no pagamento (webhook PIX).',
          };
          await fin2.from('pedidos_pagamento_comentarios').insert({
            pedido_id: ped.id, bar_id: ped.bar_id, autor_id: null, autor_nome: 'Sistema',
            mensagem: MSG[alvoPedido] || `Status atualizado pelo Inter: ${alvoPedido}.`, tipo: 'sistema',
          });
          await fin2.from('pedidos_pagamento_historico').insert({
            pedido_id: ped.id, bar_id: ped.bar_id, autor_id: null, autor_nome: 'Inter (webhook)',
            campo: 'status', valor_anterior: ped.status, valor_novo: alvoPedido,
          });
        }
      } catch (e) {
        console.error('[INTER-WEBHOOK] Falha ao propagar status pro pedido:', e);
      }
    }
  }

  // 3) Marca logs como processados (best-effort)
  if (logRows.length > 0) {
    await (supabase
      .schema('financial' as any) as any)
      .from('inter_webhook_logs')
      .update({ processado: true, processado_em: new Date().toISOString() })
      .gte('recebido_em', new Date(Date.now() - 60000).toISOString())
      .eq('processado', false);
  }

  return NextResponse.json({
    received: events.length,
    processed: processados,
    timestamp: new Date().toISOString(),
  });
}

// Inter pode fazer um GET de validação (handshake) — responde OK
export async function GET() {
  return NextResponse.json({ status: 'webhook ativo', service: 'inter-pix' });
}
