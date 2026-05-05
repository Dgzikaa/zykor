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

  // Validação token compartilhado (opcional, mas recomendado)
  if (WEBHOOK_TOKEN) {
    const tokenRecebido = request.nextUrl.searchParams.get('token');
    if (tokenRecebido !== WEBHOOK_TOKEN) {
      console.warn('[INTER-WEBHOOK] Token inválido ou ausente. IP:', ipOrigem);
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
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
    if (!codigo) continue;

    const { data: existing } = await (supabase
      .schema('financial' as any) as any)
      .from('pix_enviados')
      .select('id, status, inter_status')
      .or(`inter_codigo_solicitacao.eq.${codigo},txid.eq.${codigo}`)
      .limit(1)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      inter_status: novoStatus || null,
      last_webhook_at: new Date().toISOString(),
      last_webhook_payload: ev,
    };

    // Mapeia status Inter → status local do pix_enviados
    const statusUpper = String(novoStatus || '').toUpperCase();
    if (['EXECUTADO', 'CONCLUIDO', 'PAGO', 'COMPLETED'].includes(statusUpper)) {
      updates.status = 'pago';
    } else if (['FALHOU', 'ERRO', 'FAILED', 'REJEITADO'].includes(statusUpper)) {
      updates.status = 'erro';
    } else if (['CANCELADO', 'CANCELLED'].includes(statusUpper)) {
      updates.status = 'cancelado';
    } else if (['AGENDADO', 'SCHEDULED', 'AGUARDANDO_APROVACAO', 'PENDING'].includes(statusUpper)) {
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
