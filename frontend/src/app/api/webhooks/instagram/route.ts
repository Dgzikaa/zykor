import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

/**
 * GET/POST /api/webhooks/instagram
 *
 * Endpoint do Webhook do Meta. Fluxo:
 *
 * 1) GET: handshake inicial. Meta envia hub.mode=subscribe + hub.challenge +
 *    hub.verify_token. Validamos verify_token (env META_WEBHOOK_VERIFY_TOKEN)
 *    e devolvemos o challenge cru.
 *
 * 2) POST: evento real. Headers incluem X-Hub-Signature-256 com HMAC SHA256
 *    do body usando INSTAGRAM_APP_SECRET. Verificamos timing-safe antes de
 *    processar. Aceita eventos:
 *      - comments      (novo comment em post do bar)
 *      - mentions      (bar foi mencionado em comment de terceiro)
 *      - messages      (DM recebida)
 *      - message_reactions
 *      - messaging_seen
 *      - live_comments
 *
 * Idempotente: usa upsert por ig_comment_id / ig_message_id.
 */
export const dynamic = 'force-dynamic';

// ===== GET: handshake (Meta valida endpoint) =====
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!expected) {
    console.error('[webhook/ig GET] META_WEBHOOK_VERIFY_TOKEN ausente');
    return new NextResponse('config missing', { status: 500 });
  }

  if (mode === 'subscribe' && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('forbidden', { status: 403 });
}

// ===== POST: evento real =====
function verifySignature(body: string, sig: string | null, secret: string): boolean {
  if (!sig?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const recebido = sig.slice('sha256='.length);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(recebido, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    console.error('[webhook/ig POST] INSTAGRAM_APP_SECRET ausente');
    return new NextResponse('config missing', { status: 500 });
  }

  const raw = await req.text();
  const sig = req.headers.get('x-hub-signature-256');
  if (!verifySignature(raw, sig, appSecret)) {
    console.warn('[webhook/ig POST] assinatura invalida');
    return new NextResponse('signature invalid', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse('json invalid', { status: 400 });
  }

  const supabase = await getAdminClient();

  // Loga TUDO antes de processar (audit + replay)
  for (const entry of (payload.entry || [])) {
    for (const change of (entry.changes || [])) {
      try {
        await processarEvento(supabase, payload.object, change, entry, raw);
      } catch (e: any) {
        console.error(`[webhook/ig] erro processando ${change.field}:`, e);
        await (supabase as any).schema('integrations').from('instagram_webhook_log').insert({
          object_tipo: payload.object ?? null,
          field: change.field ?? null,
          payload: { entry, change },
          processado: false,
          erro_msg: e?.message ?? String(e),
        });
      }
    }
    // Messaging events vem em entry.messaging (formato diferente)
    for (const msg of (entry.messaging || [])) {
      try {
        await processarMensagem(supabase, payload.object, msg, entry);
      } catch (e: any) {
        console.error('[webhook/ig] erro processando msg:', e);
        await (supabase as any).schema('integrations').from('instagram_webhook_log').insert({
          object_tipo: payload.object ?? null,
          field: 'messages',
          payload: { entry, msg },
          processado: false,
          erro_msg: e?.message ?? String(e),
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}

// ====== Helpers de processamento ======

async function getBarIdByIgBusinessId(supabase: any, igBusinessId: string): Promise<number | null> {
  const { data } = await (supabase as any)
    .schema('integrations').from('instagram_contas')
    .select('bar_id').eq('ig_business_id', igBusinessId).eq('ativo', true).maybeSingle();
  return data?.bar_id ?? null;
}

async function processarEvento(supabase: any, objectTipo: string, change: any, entry: any, raw: string) {
  const field = change.field;
  const value = change.value || {};
  const igBusinessId = entry.id;
  const barId = await getBarIdByIgBusinessId(supabase, igBusinessId);

  // Sempre loga raw
  const { data: logRow } = await (supabase as any)
    .schema('integrations').from('instagram_webhook_log').insert({
      object_tipo: objectTipo,
      field,
      bar_id: barId,
      payload: { entry, change },
    }).select('id').single();

  if (!barId) {
    if (logRow) {
      await (supabase as any).schema('integrations').from('instagram_webhook_log')
        .update({ erro_msg: `bar_id n encontrado p/ ig_business_id=${igBusinessId}`, processado: false })
        .eq('id', logRow.id);
    }
    return;
  }

  if (field === 'comments') {
    // Comment novo em post do bar
    const ig_comment_id = value.id;
    const ig_media_id = value.media?.id;
    const texto = value.text;
    const autor_username = value.from?.username;
    const autor_id = value.from?.id;
    const parent_id = value.parent_id ?? null;
    if (!ig_comment_id || !ig_media_id) return;

    await (supabase as any).schema('integrations').from('instagram_comentarios').upsert({
      bar_id: barId,
      ig_comment_id,
      ig_media_id,
      parent_comment_id: parent_id,
      autor_username,
      autor_id,
      texto,
      timestamp_post: new Date().toISOString(),
      raw_data: value,
      capturado_em: new Date().toISOString(),
    }, { onConflict: 'bar_id,ig_comment_id' });
  } else if (field === 'mentions') {
    // Bar foi mencionado em post/comment de terceiro
    const ig_media_id = value.media_id ?? value.media?.id;
    const ig_comment_id = value.comment_id ?? null;
    const autor_username = value.from?.username;
    const autor_id = value.from?.id;
    if (!ig_media_id) return;

    const row = {
      bar_id: barId,
      ig_media_id,
      ig_comment_id,
      tipo_mencao: ig_comment_id ? 'comment' : 'post_tag',
      autor_username,
      autor_id,
      caption: value.caption ?? null,
      texto_comment: value.text ?? null,
      timestamp_post: new Date().toISOString(),
      raw_data: value,
      capturado_em: new Date().toISOString(),
    };
    // Sem upsert direto pq unique parcial; check + insert/update
    if (ig_comment_id) {
      const { data: ex } = await (supabase as any).schema('integrations').from('instagram_mencoes')
        .select('id').eq('bar_id', barId).eq('ig_media_id', ig_media_id).eq('ig_comment_id', ig_comment_id).maybeSingle();
      if (ex?.id) await (supabase as any).schema('integrations').from('instagram_mencoes').update(row).eq('id', ex.id);
      else await (supabase as any).schema('integrations').from('instagram_mencoes').insert(row);
    } else {
      const { data: ex } = await (supabase as any).schema('integrations').from('instagram_mencoes')
        .select('id').eq('bar_id', barId).eq('ig_media_id', ig_media_id).is('ig_comment_id', null).maybeSingle();
      if (ex?.id) await (supabase as any).schema('integrations').from('instagram_mencoes').update(row).eq('id', ex.id);
      else await (supabase as any).schema('integrations').from('instagram_mencoes').insert(row);
    }
  } else if (field === 'live_comments') {
    // Pode ser tratado igual a comments (mesma tabela)
    const ig_comment_id = value.id;
    const texto = value.text;
    const autor_username = value.from?.username;
    const autor_id = value.from?.id;
    if (!ig_comment_id) return;
    await (supabase as any).schema('integrations').from('instagram_comentarios').upsert({
      bar_id: barId,
      ig_comment_id,
      ig_media_id: value.media?.id ?? 'live',
      autor_username,
      autor_id,
      texto,
      timestamp_post: new Date().toISOString(),
      raw_data: value,
    }, { onConflict: 'bar_id,ig_comment_id' });
  }
  // Outros fields (story_insights etc.) caem no log e podem ser tratados depois

  if (logRow) {
    await (supabase as any).schema('integrations').from('instagram_webhook_log')
      .update({ processado: true }).eq('id', logRow.id);
  }
}

async function processarMensagem(supabase: any, objectTipo: string, msg: any, entry: any) {
  const igBusinessId = entry.id;
  const barId = await getBarIdByIgBusinessId(supabase, igBusinessId);

  const { data: logRow } = await (supabase as any)
    .schema('integrations').from('instagram_webhook_log').insert({
      object_tipo: objectTipo,
      field: 'messages',
      bar_id: barId,
      payload: { entry, msg },
    }).select('id').single();

  if (!barId) return;

  // msg pode ser:
  //  - { sender:{id}, recipient:{id}, message:{mid,text,attachments?,is_echo?} }
  //  - { sender:{id}, recipient:{id}, reaction:{...} }
  //  - { sender:{id}, recipient:{id}, read:{...} }
  //  - { sender:{id}, recipient:{id}, delivery:{...} }
  const senderId = msg.sender?.id;
  const recipientId = msg.recipient?.id;
  if (!senderId || !recipientId) return;

  // is_echo=true significa que a mensagem foi enviada PELO BAR (echo de POST /me/messages)
  // sender = bar, recipient = cliente
  const ehOutbound = msg.message?.is_echo === true || senderId === igBusinessId;
  const participanteId = ehOutbound ? recipientId : senderId;
  const autor = ehOutbound ? 'bar' : 'cliente';

  if (msg.message?.mid) {
    // Upsert conversa
    const { data: conversa } = await (supabase as any)
      .schema('integrations').from('instagram_conversas')
      .upsert({
        bar_id: barId,
        participante_id: participanteId,
        ultima_mensagem_em: new Date(msg.timestamp ?? Date.now()).toISOString(),
        ultima_mensagem_texto: msg.message?.text ?? '[anexo]',
        ultima_mensagem_autor: autor,
        nao_lidas_count: autor === 'cliente' ? 1 : 0,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'bar_id,participante_id' })
      .select('id').single();

    // Insert mensagem
    await (supabase as any).schema('integrations').from('instagram_mensagens').upsert({
      bar_id: barId,
      conversa_id: conversa?.id,
      ig_message_id: msg.message.mid,
      participante_id: participanteId,
      autor,
      texto: msg.message?.text ?? null,
      anexos: msg.message?.attachments ?? null,
      enviada_em: new Date(msg.timestamp ?? Date.now()).toISOString(),
      raw_data: msg,
    }, { onConflict: 'bar_id,ig_message_id' });
  }

  if (logRow) {
    await (supabase as any).schema('integrations').from('instagram_webhook_log')
      .update({ processado: true }).eq('id', logRow.id);
  }
}
