import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import crypto from 'crypto';

/**
 * POST /api/integracoes/instagram/deauthorize
 *
 * Endpoint chamado pelo Meta quando um user revoga o acesso do app dele
 * (no Instagram: Configuracoes -> Apps e sites -> Revogar). Eh um requisito
 * da App Review do Meta.
 *
 * Meta envia body com `signed_request` (form-urlencoded), formato:
 *   <signature_base64url>.<payload_base64url>
 *
 * payload eh JSON com { user_id, algorithm, issued_at, ... }
 *
 * Validacao:
 *   - HMAC-SHA256(payload_b64, app_secret) deve bater com signature
 *   - algorithm == 'HMAC-SHA256'
 *
 * Apos validar, marcamos a conta como inativa em integrations.instagram_contas.
 */
export const dynamic = 'force-dynamic';

function base64UrlDecode(input: string): Buffer {
  // base64url -> base64 padding
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

  // timing-safe compare
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
      console.error('[ig/deauthorize] INSTAGRAM_APP_SECRET ausente');
      return NextResponse.json({ error: 'config missing' }, { status: 500 });
    }

    // Meta envia form-urlencoded com signed_request
    const form = await req.formData();
    const signed = form.get('signed_request');
    if (typeof signed !== 'string' || !signed) {
      return NextResponse.json({ error: 'signed_request missing' }, { status: 400 });
    }

    const data = parseSignedRequest(signed, appSecret);
    if (!data || !data.user_id) {
      console.error('[ig/deauthorize] signed_request invalido');
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    const igUserId = String(data.user_id);

    const supabase = await getAdminClient();
    const { error } = await (supabase as any)
      .schema('integrations')
      .from('instagram_contas')
      .update({
        ativo: false,
        access_token: null,
        desconectado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('ig_business_id', igUserId);

    if (error) {
      console.error('[ig/deauthorize] erro update:', error);
      return NextResponse.json({ error: 'db error' }, { status: 500 });
    }

    // Meta n exige body de resposta especifico, 200 OK basta
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[ig/deauthorize] excecao:', e);
    return NextResponse.json({ error: e?.message || 'error' }, { status: 500 });
  }
}
