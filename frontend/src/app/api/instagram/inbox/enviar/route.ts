import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

/**
 * POST /api/instagram/inbox/enviar
 *  Body: { bar_id, conversa_id, texto }
 *
 * Envia mensagem via /me/messages do IG Graph API. Salva mensagem outbound
 * em integrations.instagram_mensagens com autor='bar'. O webhook depois
 * confirma via is_echo=true (n duplicamos pq upsert por ig_message_id).
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await authenticateUser(req);
  try {
    const body = await req.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const conversaId = Number(body?.conversa_id);
    const texto = String(body?.texto ?? '').trim();
    if (!barId || !conversaId || !texto) {
      return NextResponse.json({ error: 'bar_id, conversa_id, texto obrigatorios' }, { status: 400 });
    }

    const supabase = await getAdminClient();

    // Pega conversa + token
    const { data: conversa } = await (supabase as any)
      .schema('integrations').from('instagram_conversas')
      .select('participante_id').eq('id', conversaId).eq('bar_id', barId).maybeSingle();
    if (!conversa) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const { data: conta } = await (supabase as any)
      .schema('integrations').from('instagram_contas')
      .select('access_token, ig_business_id').eq('bar_id', barId).eq('ativo', true).maybeSingle();
    if (!conta?.access_token) {
      return NextResponse.json({ error: 'Conta IG nao conectada' }, { status: 400 });
    }

    // Envia via Graph API
    const igRes = await fetch(
      `https://graph.instagram.com/v22.0/${conta.ig_business_id}/messages?access_token=${conta.access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: conversa.participante_id },
          message: { text: texto },
        }),
      },
    );
    const igJson = await igRes.json();
    if (!igRes.ok) {
      console.error('[inbox/enviar] IG erro:', igJson);
      return NextResponse.json({ error: 'Falha ao enviar', detalhes: igJson }, { status: 502 });
    }

    // Salva local (autor=bar). ig_message_id vem do retorno
    const igMessageId = igJson.message_id ?? `local_${Date.now()}`;
    await (supabase as any).schema('integrations').from('instagram_mensagens').upsert({
      bar_id: barId,
      conversa_id: conversaId,
      ig_message_id: igMessageId,
      participante_id: conversa.participante_id,
      autor: 'bar',
      texto,
      enviada_em: new Date().toISOString(),
      raw_data: igJson,
    }, { onConflict: 'bar_id,ig_message_id' });

    await (supabase as any).schema('integrations').from('instagram_conversas').update({
      ultima_mensagem_em: new Date().toISOString(),
      ultima_mensagem_texto: texto,
      ultima_mensagem_autor: 'bar',
      atualizado_em: new Date().toISOString(),
    }).eq('id', conversaId);

    return NextResponse.json({ success: true, ig_message_id: igMessageId });
  } catch (e: any) {
    console.error('[inbox/enviar] excecao:', e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
