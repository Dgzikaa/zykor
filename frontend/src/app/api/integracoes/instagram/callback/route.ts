import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/integracoes/instagram/callback?code=...&state=...
 *
 * Instagram Business Login (não Facebook Login). Fluxo:
 *   1. Valida state (CSRF)
 *   2. Troca code por short-lived token em api.instagram.com
 *   3. Estende pra long-lived (60d) em graph.instagram.com
 *   4. Busca info da conta (user_id, username, account_type)
 *   5. Salva em integrations.instagram_contas (1 linha por bar)
 *   6. Redireciona pro frontend
 */
export const dynamic = 'force-dynamic';

const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const IG_GRAPH = 'https://graph.instagram.com';

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const code = sp.get('code');
  const state = sp.get('state');
  const erroMeta = sp.get('error');
  const erroMsg = sp.get('error_description') || sp.get('error_reason');

  const baseRedirect =
    (process.env.NEXT_PUBLIC_SITE_URL || 'https://zykor.com.br') +
    '/configuracoes/administracao/integracoes';

  if (erroMeta) {
    return NextResponse.redirect(
      `${baseRedirect}?ig_status=erro&ig_msg=${encodeURIComponent(erroMsg || erroMeta)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseRedirect}?ig_status=erro&ig_msg=parametros_ausentes`);
  }

  try {
    const appId = process.env.INSTAGRAM_APP_ID!;
    const appSecret = process.env.INSTAGRAM_APP_SECRET!;
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI!;
    if (!appId || !appSecret || !redirectUri) {
      throw new Error('INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET/META_OAUTH_REDIRECT_URI ausentes');
    }

    const supabase = await getAdminClient();

    // 1. Valida state
    const { data: stateRow, error: stateErr } = await supabase
      .from('instagram_oauth_states')
      .select('bar_id, expires_at, consumido_em')
      .eq('state', state)
      .maybeSingle();

    if (stateErr || !stateRow) {
      return NextResponse.redirect(`${baseRedirect}?ig_status=erro&ig_msg=state_invalido`);
    }
    if ((stateRow as any).consumido_em) {
      return NextResponse.redirect(`${baseRedirect}?ig_status=erro&ig_msg=state_ja_usado`);
    }
    if (new Date((stateRow as any).expires_at).getTime() < Date.now()) {
      return NextResponse.redirect(`${baseRedirect}?ig_status=erro&ig_msg=state_expirado`);
    }

    const barId = (stateRow as any).bar_id as number;

    // 2. Troca code por short-lived token (api.instagram.com — form-encoded)
    const tokenForm = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    const shortRes = await fetch(IG_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenForm.toString(),
    });
    const shortJson = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) {
      console.error('[ig/callback] short token erro:', shortJson);
      throw new Error(`Falha trocando code: ${JSON.stringify(shortJson).slice(0, 300)}`);
    }
    const shortToken = shortJson.access_token as string;
    const igUserId = String(shortJson.user_id);

    // 3. Estende pra long-lived (60 dias) — graph.instagram.com
    const longRes = await fetch(
      `${IG_GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`,
    );
    const longJson = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      console.error('[ig/callback] long token erro:', longJson);
      throw new Error(`Falha estendendo token: ${JSON.stringify(longJson).slice(0, 300)}`);
    }
    const longToken = longJson.access_token as string;
    const expiresIn = Number(longJson.expires_in) || 60 * 24 * 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 4. Busca dados da conta
    const meRes = await fetch(
      `${IG_GRAPH}/v22.0/me?fields=user_id,username,name,account_type&access_token=${longToken}`,
    );
    const meJson = await meRes.json();
    if (!meRes.ok) {
      console.error('[ig/callback] /me erro:', meJson);
      throw new Error(`Falha lendo perfil IG: ${JSON.stringify(meJson).slice(0, 300)}`);
    }

    // 5. Marca state consumido + upsert da conta
    await supabase
      .from('instagram_oauth_states')
      .update({ consumido_em: new Date().toISOString() })
      .eq('state', state);

    // Pega user que iniciou (best-effort)
    let conectadoPorUsuario: string | null = null;
    try {
      const authCookie = req.cookies.get('sb-access-token')?.value;
      if (authCookie) {
        const { data: usr } = await supabase.auth.getUser(authCookie);
        conectadoPorUsuario = usr?.user?.id || null;
      }
    } catch {
      /* ignora */
    }

    const { error: upsertErr } = await supabase
      .from('instagram_contas')
      .upsert(
        {
          bar_id: barId,
          ig_business_id: meJson.user_id || igUserId,
          ig_username: meJson.username || null,
          // Sem Facebook Page intermediária no Instagram Business Login direto;
          // armazenamos o próprio IG ID como placeholder pra constraint NOT NULL
          facebook_page_id: meJson.user_id || igUserId,
          facebook_page_name: meJson.name || meJson.username || null,
          access_token: longToken,
          token_type: 'ig_long_lived',
          expires_at: expiresAt,
          scopes: [
            'instagram_business_basic',
            'instagram_business_manage_comments',
            'instagram_business_manage_messages',
            'instagram_business_content_publish',
          ],
          ativo: true,
          conectado_em: new Date().toISOString(),
          conectado_por_usuario: conectadoPorUsuario,
          desconectado_em: null,
        },
        { onConflict: 'bar_id' },
      );

    if (upsertErr) {
      console.error('[ig/callback] upsert erro:', upsertErr);
      throw new Error(`Falha salvando conta: ${upsertErr.message}`);
    }

    return NextResponse.redirect(
      `${baseRedirect}?ig_status=ok&ig_username=${encodeURIComponent(meJson.username || '')}`,
    );
  } catch (e: any) {
    console.error('[ig/callback] exceção:', e);
    return NextResponse.redirect(
      `${baseRedirect}?ig_status=erro&ig_msg=${encodeURIComponent(e?.message || 'Erro inesperado')}`,
    );
  }
}
