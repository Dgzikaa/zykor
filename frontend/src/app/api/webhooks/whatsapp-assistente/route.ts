import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhooks/whatsapp-assistente
 *
 * Recebe payload do Umbler quando chega mensagem no número do bot Zykor.
 * Detecta { telefone, mensagem } e dispara edge fn whatsapp-assistente.
 * Responde via Umbler API (campo `umbler_api_token` em env).
 *
 * Também aceita POST direto pra teste manual:
 *   { telefone: "5561999999999", mensagem: "como foi sabado?" }
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Adapta payload Umbler OR JSON simples
    let telefone = '';
    let mensagem = '';
    let umblerChatId: string | null = null;

    if (body?.telefone && body?.mensagem) {
      telefone = String(body.telefone);
      mensagem = String(body.mensagem);
    } else if (body?.Type === 'Message' && body?.Payload?.Content) {
      // Formato webhook Umbler
      telefone = body?.Payload?.Contact?.PhoneNumber || '';
      mensagem = body?.Payload?.Content || '';
      umblerChatId = body?.Payload?.ChatId || null;
    } else {
      return NextResponse.json({ error: 'payload invalido' }, { status: 400 });
    }

    if (!telefone || !mensagem) {
      return NextResponse.json({ skipped: true });
    }

    // Dispara edge fn
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const fnRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-assistente`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, mensagem }),
    });
    const fnJson = await fnRes.json();
    if (!fnRes.ok) {
      console.error('[wa-assist] fn erro:', fnJson);
      return NextResponse.json(fnJson, { status: 502 });
    }

    const resposta = fnJson.resposta;

    // Envia de volta via Umbler se tem token + chat id
    const umblerToken = process.env.UMBLER_API_TOKEN;
    if (umblerToken && umblerChatId && resposta) {
      try {
        await fetch('https://app-utalk.umbler.com/api/v1/messages/simplified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${umblerToken}` },
          body: JSON.stringify({
            ToContact: { PhoneNumber: telefone },
            Content: resposta,
          }),
        });
      } catch (e) {
        console.error('[wa-assist] erro envio Umbler:', e);
      }
    }

    return NextResponse.json({ received: true, resposta });
  } catch (e: any) {
    console.error('[wa-assist] excecao:', e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
