import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, permissionErrorResponse } from '@/middleware/auth';
import { getAdminClient } from '@/lib/supabase-admin';

/**
 * GET /api/integracoes/instagram/diagnostico
 *
 * Existe porque a conexão do Instagram falha num lugar onde não dá pra enxergar: quando a
 * conta não tem papel no app, a Meta mostra a tela DELA
 * (instagram.com/oauth/authorize/third_party/error) e nem chama o nosso redirect_uri — não
 * chega nada no Zykor pra logar. Sem isto aqui, a investigação vira chute.
 *
 * Mostra o que o servidor realmente está usando (o app_id não é segredo — ele viaja na URL
 * do OAuth), o histórico de tentativas por bar e quem já conectou. Assim dá pra comparar com
 * o painel da Meta sem precisar adivinhar.
 *
 * ADMIN-ONLY: expõe configuração de integração.
 */
export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.facebook.com/v21.0';

async function graph(caminho: string, token: string) {
  try {
    const r = await fetch(`${GRAPH}/${caminho}${caminho.includes('?') ? '&' : '?'}access_token=${token}`, {
      signal: AbortSignal.timeout(8000),
    });
    const json = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, json };
  } catch (e: any) {
    return { ok: false, status: 0, json: { erro_local: e?.message || String(e) } };
  }
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return permissionErrorResponse('Usuário não autenticado');
  if ((user.role as string) !== 'admin') return permissionErrorResponse('Somente admin');

  const appId = process.env.INSTAGRAM_APP_ID || null;
  const appSecret = process.env.INSTAGRAM_APP_SECRET || null;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI || null;

  const supabase = await getAdminClient();

  const { data: contas } = await supabase
    .from('instagram_contas')
    .select('bar_id, ig_username, account_type, ativo, conectado_em, expires_at')
    .order('bar_id');

  const { data: tentativas } = await supabase
    .from('instagram_oauth_states')
    .select('bar_id, iniciado_em, consumido_em, erro, erro_em')
    .order('iniciado_em', { ascending: false })
    .limit(20);

  // Best-effort: o app do Instagram Business Login nem sempre responde no graph.facebook.com
  // (o id do sub-app Instagram é diferente do app id do Facebook). Se falhar, não é problema
  // — o que interessa mesmo é o app_id acima, pra bater com o painel.
  let app: unknown = null;
  let papeis: unknown = null;
  if (appId && appSecret) {
    const token = `${appId}|${appSecret}`;
    app = (await graph(`${appId}?fields=id,name,link,app_type`, token)).json;
    papeis = (await graph(`${appId}/roles`, token)).json;
  }

  return NextResponse.json({
    success: true,
    config: {
      // o app_id aparece como client_id na URL do OAuth, então não é segredo
      instagram_app_id: appId,
      instagram_app_secret_configurado: !!appSecret,
      redirect_uri: redirectUri,
    },
    // Compare este app_id com o do painel da Meta onde os testadores estão aprovados.
    como_ler:
      'instagram_app_id tem que ser o MESMO app onde as contas aparecem como Testadores do Instagram. ' +
      'Tentativa com consumido_em=null e erro=null significa que a Meta barrou na tela dela e nem redirecionou ' +
      '— nesse caso a causa está no painel da Meta (papel da conta), não no Zykor.',
    contas_conectadas: contas ?? [],
    ultimas_tentativas: tentativas ?? [],
    meta_app: app,
    meta_papeis: papeis,
  });
}
