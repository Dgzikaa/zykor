// Token do Conta Azul com REFRESH ON-DEMAND.
//
// Problema: o access_token do CA dura ~1h. O refresh só rodava no cron (edge function
// contaazul-sync, a cada ~6 min). As rotas de pagamento (getCAToken em lancamentos) só LIAM o
// token — se ele tivesse expirado na janela entre um cron e outro, o pagamento falhava com
// "Token CA expirado" mesmo tendo um refresh_token válido do lado. Aqui o token se auto-cura:
// se estiver expirando, renova na hora usando o refresh_token e salva o rotacionado.
//
// Rotação: o CA invalida o refresh_token a cada uso e devolve um novo (salvamos o novo). Se duas
// coisas renovam ao mesmo tempo (este on-demand + o cron), uma pega invalid_grant — nesse caso
// RE-LEMOS a credencial (a outra já salvou um token fresco) e usamos esse. Sem lock duro; a
// releitura cobre a corrida (o refresh que falha nunca zera o token salvo).

const CONTA_AZUL_AUTH_URL = 'https://auth.contaazul.com';
const BUFFER_MS = 60_000; // renova se faltar menos de 60s pra expirar

export type CATokenOk = { token: string };
export type CATokenErr = { error: string; status: number };

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

function tokenValido(c: { access_token?: string | null; expires_at?: string | null } | null): boolean {
  return !!c?.access_token && !!c?.expires_at && new Date(c.expires_at).getTime() - Date.now() > BUFFER_MS;
}

/**
 * Devolve um access_token VÁLIDO do Conta Azul pro bar, renovando na hora se preciso.
 * `supabase` = client admin (service role). Não lança: retorna { token } ou { error, status }.
 */
export async function getCAValidToken(supabase: any, barId: number): Promise<CATokenOk | CATokenErr> {
  const { data: cred, error } = await supabase
    .from('api_credentials')
    .select('id, access_token, refresh_token, expires_at, client_id, client_secret')
    .eq('sistema', 'conta_azul')
    .eq('bar_id', barId)
    .single();

  if (error || !cred) return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  if (tokenValido(cred)) return { token: cred.access_token };

  // Precisa renovar. Sem refresh_token/credencial de app → só reconectando.
  if (!cred.refresh_token || !cred.client_id || !cred.client_secret) {
    return { error: 'Conta Azul desconectado. Reconecte o Conta Azul em Integrações.', status: 401 };
  }

  const relerSalvo = async (): Promise<CATokenOk | null> => {
    const { data: fresh } = await supabase
      .from('api_credentials').select('access_token, expires_at').eq('id', cred.id).single();
    return tokenValido(fresh) ? { token: fresh.access_token } : null;
  };

  try {
    const r = await fetch(`${CONTA_AZUL_AUTH_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth(cred.client_id, cred.client_secret)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cred.refresh_token }).toString(),
    });

    if (!r.ok) {
      // invalid_grant / rotação concorrente → o cron pode ter renovado agora; usa o salvo se valer.
      const salvo = await relerSalvo();
      if (salvo) return salvo;
      return { error: 'Conta Azul desconectado (renovação falhou). Reconecte em Integrações.', status: 401 };
    }

    const t = await r.json();
    if (!t?.access_token) {
      const salvo = await relerSalvo();
      if (salvo) return salvo;
      return { error: 'Conta Azul não retornou o token na renovação.', status: 502 };
    }
    const expiresAt = new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString();
    await supabase.from('api_credentials').update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? cred.refresh_token,
      expires_at: expiresAt,
      atualizado_em: new Date().toISOString(),
    }).eq('id', cred.id);
    return { token: t.access_token };
  } catch {
    const salvo = await relerSalvo();
    if (salvo) return salvo;
    return { error: 'Falha de rede ao renovar o token do Conta Azul. Tente de novo.', status: 502 };
  }
}
