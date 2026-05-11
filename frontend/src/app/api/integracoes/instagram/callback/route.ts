import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/integracoes/instagram/callback?code=...&state=...
 *
 * Meta redireciona aqui após o usuário autorizar. A gente:
 *   1. Valida o state (CSRF)
 *   2. Troca `code` por short-lived user token
 *   3. Estende pra long-lived (60 dias)
 *   4. Lista Pages do usuário e pega o IG Business vinculado
 *   5. Salva em integrations.instagram_contas (1 linha por bar)
 *   6. Redireciona pro frontend com ?status=ok|erro
 */
export const dynamic = 'force-dynamic';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const code = sp.get('code');
  const state = sp.get('state');
  const erroMeta = sp.get('error');
  const erroMsg = sp.get('error_description') || sp.get('error_reason');

  const baseRedirect = (process.env.NEXT_PUBLIC_SITE_URL || 'https://zykor.com.br')
    + '/configuracoes/administracao/integracoes';

  if (erroMeta) {
    return NextResponse.redirect(
      `${baseRedirect}?ig_status=erro&ig_msg=${encodeURIComponent(erroMsg || erroMeta)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseRedirect}?ig_status=erro&ig_msg=parametros_ausentes`);
  }

  try {
    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI!;
    if (!appId || !appSecret || !redirectUri) {
      throw new Error('META_APP_ID/META_APP_SECRET/META_OAUTH_REDIRECT_URI ausentes');
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

    // 2. Troca code por short-lived token
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });
    const shortRes = await fetch(`${GRAPH_API}/oauth/access_token?${tokenParams.toString()}`);
    const shortJson = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) {
      console.error('[ig/callback] short token erro:', shortJson);
      throw new Error(`Falha trocando code: ${JSON.stringify(shortJson).slice(0, 300)}`);
    }
    const shortToken = shortJson.access_token as string;

    // 3. Estende pra long-lived (60 dias)
    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    });
    const longRes = await fetch(`${GRAPH_API}/oauth/access_token?${longParams.toString()}`);
    const longJson = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      console.error('[ig/callback] long token erro:', longJson);
      throw new Error(`Falha estendendo token: ${JSON.stringify(longJson).slice(0, 300)}`);
    }
    const longToken = longJson.access_token as string;
    const expiresIn = Number(longJson.expires_in) || 60 * 24 * 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 4. Lista Pages do usuário
    const pagesRes = await fetch(
      `${GRAPH_API}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url,name}&access_token=${longToken}`,
    );
    const pagesJson = await pagesRes.json();
    if (!pagesRes.ok) {
      console.error('[ig/callback] pages erro:', pagesJson);
      throw new Error(`Falha listando pages: ${JSON.stringify(pagesJson).slice(0, 300)}`);
    }

    const pages = (pagesJson.data || []) as Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>;

    const pageComIg = pages.find(p => p.instagram_business_account?.id);
    if (!pageComIg) {
      return NextResponse.redirect(
        `${baseRedirect}?ig_status=erro&ig_msg=${encodeURIComponent(
          'Nenhuma Page com Instagram Business vinculado encontrada — confira no app FB do dono se a Page certa foi autorizada',
        )}`,
      );
    }

    // 5. Marca state como consumido + upsert da conta
    await supabase
      .from('instagram_oauth_states')
      .update({ consumido_em: new Date().toISOString() })
      .eq('state', state);

    // Pega user que iniciou (header de auth Supabase) — se rolar, salva quem conectou
    let conectadoPorUsuario: string | null = null;
    try {
      const authCookie = req.cookies.get('sb-access-token')?.value;
      if (authCookie) {
        // best-effort, sem quebrar fluxo se falhar
        const { data: usr } = await supabase.auth.getUser(authCookie);
        conectadoPorUsuario = usr?.user?.id || null;
      }
    } catch { /* ignora */ }

    const igAccount = pageComIg.instagram_business_account!;

    const { error: upsertErr } = await supabase
      .from('instagram_contas')
      .upsert(
        {
          bar_id: barId,
          ig_business_id: igAccount.id,
          ig_username: igAccount.username || null,
          facebook_page_id: pageComIg.id,
          facebook_page_name: pageComIg.name,
          access_token: pageComIg.access_token, // Page token (não expira se long-lived user token foi usado)
          token_type: 'page_long_lived',
          expires_at: expiresAt,
          scopes: ['instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'],
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
      `${baseRedirect}?ig_status=ok&ig_username=${encodeURIComponent(igAccount.username || '')}`,
    );
  } catch (e: any) {
    console.error('[ig/callback] exceção:', e);
    return NextResponse.redirect(
      `${baseRedirect}?ig_status=erro&ig_msg=${encodeURIComponent(e?.message || 'Erro inesperado')}`,
    );
  }
}
