import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

/**
 * POST /api/integracoes/instagram/data-deletion
 *
 * Endpoint chamado pelo Meta quando user pede delecao de dados. Eh um requisito
 * da App Review do Meta (LGPD/GDPR).
 *
 * Igual ao deauthorize, Meta envia body form-urlencoded com signed_request
 * (HMAC-SHA256 + payload base64url). Validamos assinatura, registramos a
 * request, marcamos a conta como desconectada (em sync com /deauthorize),
 * e retornamos JSON { url, confirmation_code } pro Meta.
 *
 * O `url` eh pagina publica onde o user pode consultar status:
 *   https://zykor.com.br/integracoes/instagram/data-deletion-status?code=<code>
 *
 * Como o Zykor n armazena dados pessoais do user final do IG (so token + ID +
 * username do bar), a delecao eh imediata. O delete row no instagram_contas
 * remove o token e marca desconectado_em.
 */
export const dynamic = 'force-dynamic';

function base64UrlDecode(input: string): Buffer {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function parseSignedRequest(signed: string, appSecret: string): any | null {
  const parts = signed.split('.');
  if (parts.length !== 2) return null;
  const [encodedSig, payload] = parts;

  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest();
  const actualSig = base64UrlDecode(encodedSig);

  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload).toString('utf-8'));
    if (data.algorithm !== 'HMAC-SHA256') return null;
    return data;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appSecret) {
      console.error('[ig/data-deletion] INSTAGRAM_APP_SECRET ausente');
      return NextResponse.json({ error: 'config missing' }, { status: 500 });
    }

    const form = await req.formData();
    const signed = form.get('signed_request');
    if (typeof signed !== 'string' || !signed) {
      return NextResponse.json({ error: 'signed_request missing' }, { status: 400 });
    }

    const data = parseSignedRequest(signed, appSecret);
    if (!data || !data.user_id) {
      console.error('[ig/data-deletion] signed_request invalido');
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    const igUserId = String(data.user_id);
    const confirmationCode = crypto.randomBytes(16).toString('hex');

    const supabase = await getAdminClient();

    // 1. Registra request p/ rastreio
    const { data: contaRow } = await (supabase as any)
      .schema('integrations')
      .from('instagram_contas')
      .select('bar_id')
      .eq('ig_business_id', igUserId)
      .maybeSingle();

    await (supabase as any)
      .schema('integrations')
      .from('instagram_data_deletion_requests')
      .insert({
        confirmation_code: confirmationCode,
        ig_user_id: igUserId,
        bar_id: contaRow?.bar_id ?? null,
        status: 'em_processamento',
        raw_signed_request: signed.slice(0, 1000),
      });

    // 2. Executa delecao: remove token + marca desconectado.
    //    Zykor n armazena dados pessoais do user final do IG alem do que esta
    //    em instagram_contas (token + ig_user_id + username). Limpamos tudo.
    const { error: updErr } = await (supabase as any)
      .schema('integrations')
      .from('instagram_contas')
      .update({
        ativo: false,
        access_token: null,
        ig_username: null,
        desconectado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('ig_business_id', igUserId);

    if (updErr) {
      console.error('[ig/data-deletion] erro update conta:', updErr);
      await (supabase as any)
        .schema('integrations')
        .from('instagram_data_deletion_requests')
        .update({ status: 'erro', erro_msg: updErr.message })
        .eq('confirmation_code', confirmationCode);
    } else {
      await (supabase as any)
        .schema('integrations')
        .from('instagram_data_deletion_requests')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('confirmation_code', confirmationCode);
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zykor.com.br';
    return NextResponse.json({
      url: `${baseUrl}/integracoes/instagram/data-deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (e: any) {
    console.error('[ig/data-deletion] excecao:', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
