/**
 * OAuth do Google por bar, com REFRESH ON-DEMAND — mesmo desenho de `lib/contaazul/token.ts`.
 *
 * O access_token do Google dura 1h. Em vez de depender do cron pra renovar (e falhar em toda
 * chamada feita na janela entre dois crons), o token se auto-cura: quem precisa dele chama
 * `getGoogleAccessToken` e recebe um token válido, renovado na hora se preciso.
 *
 * Diferença pro Conta Azul: o Google NÃO rotaciona o refresh_token — o mesmo refresh vale
 * indefinidamente, e a resposta da renovação só traz access_token. Por isso não há corrida de
 * rotação pra tratar aqui.
 *
 * ARMADILHA CONHECIDA: o Google só devolve refresh_token na PRIMEIRA autorização de uma conta.
 * Reautorizar sem `prompt=consent` devolve access_token sem refresh — por isso o authUrl abaixo
 * força `prompt=consent` sempre. E se a tela de consentimento do projeto estiver em modo
 * "Testing", o refresh expira em 7 dias; o app precisa estar publicado (Internal serve).
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const BUFFER_MS = 60_000; // renova se faltar menos de 60s pra expirar

/**
 * `business.manage` = Google Meu Negócio (fichas + Performance API).
 * `userinfo.email` = saber QUAL conta autorizou — o OAuth concede acesso à conta logada no
 * navegador, não ao bar escolhido na tela, então mostrar o e-mail é o que permite flagrar
 * conexão feita com a conta errada (já mordeu no Conta Azul).
 *
 * O escopo do Google Ads (`https://www.googleapis.com/auth/adwords`) entra aqui quando houver
 * developer token — deixado de fora por enquanto porque escopo não registrado na tela de
 * consentimento derruba a autorização inteira, inclusive a parte do Meu Negócio que já funciona.
 * Override por env pra dar pra ligar sem deploy.
 */
export const GOOGLE_SCOPES: string[] = (
  process.env.GOOGLE_OAUTH_SCOPES ||
  'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/userinfo.email'
).split(/\s+/).filter(Boolean);

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Lê a config do env. Retorna null (em vez de lançar) pra rota responder erro legível. */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_SITE_URL || 'https://zykor.com.br'}/api/integracoes/google/callback`;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleAuthUrl(cfg: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    // offline + consent = garantia de refresh_token (ver comentário do topo)
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

export async function exchangeGoogleCode(
  cfg: GoogleOAuthConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });
  const json = await r.json();
  if (!r.ok || !json?.access_token) {
    throw new Error(`Falha trocando code: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json as GoogleTokenResponse;
}

/** E-mail da conta que autorizou (best-effort — não vale derrubar a conexão por causa disso). */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.email || null;
  } catch {
    return null;
  }
}

export type GoogleTokenOk = { token: string };
export type GoogleTokenErr = { error: string; status: number };

function tokenValido(c: { access_token?: string | null; expires_at?: string | null } | null): boolean {
  return !!c?.access_token && !!c?.expires_at && new Date(c.expires_at).getTime() - Date.now() > BUFFER_MS;
}

/**
 * Devolve um access_token VÁLIDO do Google pro bar, renovando na hora se preciso.
 * `supabase` = client service role. Não lança: retorna { token } ou { error, status }.
 */
export async function getGoogleAccessToken(
  supabase: any,
  barId: number,
): Promise<GoogleTokenOk | GoogleTokenErr> {
  const { data: cred, error } = await supabase
    .schema('integrations')
    .from('google_oauth_tokens')
    .select('id, access_token, refresh_token, expires_at, ativo')
    .eq('bar_id', barId)
    .maybeSingle();

  if (error || !cred) {
    return { error: 'Google não conectado para este bar. Conecte em Integrações.', status: 404 };
  }
  if (cred.ativo === false) {
    return { error: 'Conexão do Google está desconectada. Reconecte em Integrações.', status: 401 };
  }
  if (tokenValido(cred)) return { token: cred.access_token };

  if (!cred.refresh_token) {
    return { error: 'Google desconectado (sem refresh token). Reconecte em Integrações.', status: 401 };
  }

  const cfg = getGoogleOAuthConfig();
  if (!cfg) return { error: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes no env.', status: 500 };

  try {
    const r = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: cred.refresh_token,
        grant_type: 'refresh_token',
      }).toString(),
    });
    const t = await r.json();

    if (!r.ok || !t?.access_token) {
      // invalid_grant aqui = consentimento revogado, senha trocada, ou app ainda em "Testing"
      // (refresh de 7 dias). Nenhum desses se resolve tentando de novo — só reconectando.
      const motivo = t?.error === 'invalid_grant'
        ? 'Autorização do Google expirou ou foi revogada. Reconecte em Integrações.'
        : `Falha renovando token do Google: ${JSON.stringify(t).slice(0, 200)}`;
      await supabase
        .schema('integrations')
        .from('google_oauth_tokens')
        .update({ ultimo_erro: motivo.slice(0, 500), ultimo_erro_em: new Date().toISOString() })
        .eq('id', cred.id);
      return { error: motivo, status: 401 };
    }

    const expiresAt = new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString();
    await supabase
      .schema('integrations')
      .from('google_oauth_tokens')
      .update({
        access_token: t.access_token,
        expires_at: expiresAt,
        ultimo_erro: null,
        ultimo_erro_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cred.id);

    return { token: t.access_token };
  } catch {
    return { error: 'Falha de rede ao renovar o token do Google. Tente de novo.', status: 502 };
  }
}
