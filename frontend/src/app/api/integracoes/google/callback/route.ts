import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  exchangeGoogleCode,
  fetchGoogleEmail,
  getGoogleOAuthConfig,
  GOOGLE_SCOPES,
} from '@/lib/google/oauth';
import { listarFichas } from '@/lib/google/business-profile';

/**
 * GET /api/integracoes/google/callback?code=...&state=...
 *
 * 1. Valida o state (CSRF)
 * 2. Troca o code por access + refresh token
 * 3. Descobre o e-mail que autorizou (pra flagrar conexão feita com a conta errada)
 * 4. Tenta listar as fichas e, se houver só UMA, já amarra ela ao bar
 * 5. Salva em integrations.google_oauth_tokens (1 linha por bar)
 *
 * O passo 4 é best-effort de propósito: se a Business Profile API ainda não tiver acesso
 * liberado, a conexão é salva mesmo assim e a tela pede pra escolher a ficha depois. O
 * contrário — abortar a conexão porque a listagem falhou — jogaria fora o refresh_token, que
 * é a parte cara do fluxo (o Google só o entrega no primeiro consentimento).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const code = sp.get('code');
  const state = sp.get('state');
  const erroGoogle = ['error', 'error_description', 'error_subtype']
    .map((k) => [k, sp.get(k)] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join(' | ');

  const baseRedirect =
    (process.env.NEXT_PUBLIC_SITE_URL || 'https://zykor.com.br') +
    '/configuracoes/administracao/integracoes';

  /** Deixa o motivo gravado no state — sem isso o erro só vive no log da Vercel e some na rotação. */
  async function registrarFalha(motivo: string) {
    if (!state) return;
    try {
      const sb = await getAdminClient();
      await sb
        .schema('integrations')
        .from('google_oauth_states')
        .update({ erro: motivo.slice(0, 500), erro_em: new Date().toISOString() })
        .eq('state', state);
    } catch (e) {
      console.error('[google/callback] não consegui registrar a falha no state:', e);
    }
  }

  const falhar = async (motivo: string, paraBanco?: string) => {
    console.error('[google/callback] falhou:', paraBanco || motivo);
    await registrarFalha(paraBanco || motivo);
    return NextResponse.redirect(
      `${baseRedirect}?google_status=erro&google_msg=${encodeURIComponent(motivo)}`,
    );
  };

  if (sp.get('error')) return falhar(sp.get('error_description') || sp.get('error')!, erroGoogle);
  if (!code || !state) {
    return NextResponse.redirect(`${baseRedirect}?google_status=erro&google_msg=parametros_ausentes`);
  }

  try {
    const cfg = getGoogleOAuthConfig();
    if (!cfg) throw new Error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes');

    const supabase = await getAdminClient();

    // 1. Valida state
    const { data: stateRow } = await supabase
      .schema('integrations')
      .from('google_oauth_states')
      .select('bar_id, expires_at, consumido_em')
      .eq('state', state)
      .maybeSingle();

    if (!stateRow) {
      return NextResponse.redirect(`${baseRedirect}?google_status=erro&google_msg=state_invalido`);
    }
    if ((stateRow as any).consumido_em) return falhar('state_ja_usado');
    if (new Date((stateRow as any).expires_at).getTime() < Date.now()) return falhar('state_expirado');

    const barId = Number((stateRow as any).bar_id);

    // 2. Troca code por tokens
    const tokens = await exchangeGoogleCode(cfg, code);
    const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString();

    // 3. Quem autorizou (o Google concede acesso à conta LOGADA no navegador, não ao bar
    //    escolhido na tela — mostrar o e-mail é o que permite perceber a troca)
    const email = await fetchGoogleEmail(tokens.access_token);

    // 4. Fichas visíveis (best-effort). Só amarra sozinho quando não há ambiguidade.
    let locationId: string | null = null;
    let locationNome: string | null = null;
    let accountId: string | null = null;
    let accountNome: string | null = null;
    let avisoFichas: string | null = null;
    try {
      const fichas = await listarFichas(tokens.access_token);
      if (fichas.length === 1) {
        locationId = fichas[0].name;
        locationNome = fichas[0].title;
        accountId = fichas[0].accountName;
        accountNome = fichas[0].accountNome;
      } else if (fichas.length === 0) {
        avisoFichas = 'A conta autorizada não administra nenhuma ficha do Google Meu Negócio.';
      }
      // >1 ficha: escolha manual na tela (uma conta de gestão enxerga as fichas de todos os bares)
    } catch (e: any) {
      avisoFichas = e?.message || 'Não foi possível listar as fichas.';
      console.error('[google/callback] listagem de fichas falhou:', avisoFichas);
    }

    // 5. Marca state consumido + upsert da conexão
    await supabase
      .schema('integrations')
      .from('google_oauth_states')
      .update({ consumido_em: new Date().toISOString() })
      .eq('state', state);

    let conectadoPorUsuario: string | null = null;
    try {
      const authCookie = req.cookies.get('sb-access-token')?.value;
      if (authCookie) {
        const { data: usr } = await supabase.auth.getUser(authCookie);
        conectadoPorUsuario = usr?.user?.id || null;
      }
    } catch {
      /* best-effort */
    }

    const { error: upsertErr } = await supabase
      .schema('integrations')
      .from('google_oauth_tokens')
      .upsert(
        {
          bar_id: barId,
          access_token: tokens.access_token,
          // O Google só devolve refresh_token no primeiro consentimento. Pedimos prompt=consent
          // justamente pra ele vir sempre — mas se vier vazio, NÃO sobrescreve o que já existe.
          ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
          expires_at: expiresAt,
          scopes: tokens.scope ? tokens.scope.split(' ') : GOOGLE_SCOPES,
          google_email: email,
          ...(locationId ? { location_id: locationId, location_nome: locationNome } : {}),
          ...(accountId ? { account_id: accountId, account_nome: accountNome } : {}),
          ativo: true,
          conectado_em: new Date().toISOString(),
          conectado_por_usuario: conectadoPorUsuario,
          desconectado_em: null,
          ultimo_erro: avisoFichas,
          ultimo_erro_em: avisoFichas ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'bar_id' },
      );

    if (upsertErr) throw new Error(`Falha salvando conexão: ${upsertErr.message}`);

    const qs = new URLSearchParams({ google_status: 'ok' });
    if (email) qs.set('google_email', email);
    if (locationNome) qs.set('google_ficha', locationNome);
    // Conectado mas sem ficha amarrada: a tela precisa mandar o usuário escolher.
    if (!locationId) qs.set('google_pendente', avisoFichas || 'escolher_ficha');

    return NextResponse.redirect(`${baseRedirect}?${qs.toString()}`);
  } catch (e: any) {
    console.error('[google/callback] exceção:', e);
    return falhar(e?.message || 'Erro inesperado');
  }
}
