/**
 * Fonte ÚNICA do token da API Umbler Talk.
 *
 * Modelo real: UMA conta Umbler (um token) serve os 2 bares; a diferença por bar/finalidade
 * é o CANAL/número (agente), não a conta. Por isso o token fica em `integrations.umbler_account`
 * (registro único id=1), gerenciável pela tela de Integrações. O env `UMBLER_API_TOKEN` é a
 * rede de segurança (fallback) — é o token que os alertas já usam (`whatsapp-send.ts`).
 *
 * Resolução do token: `umbler_account.api_token` (se preenchido) → senão env.
 *
 * Histórico (10/07/26): antes o token vinha de `umbler_config.api_token` por bar, que ficou
 * STALE (401) por volta de abr/26 (o sync de `umbler_mensagens` congelou em 16/04). Migrado
 * pra conta única. org/from têm fallback pros valores conhecidos do canal "Zykor Notificações".
 */
export const UMBLER_API_BASE = 'https://app-utalk.umbler.com/api';
export const UMBLER_API_V1 = `${UMBLER_API_BASE}/v1`;

export const UMBLER_TOKEN_ENV = process.env.UMBLER_API_TOKEN || '';
export const UMBLER_ORG_FALLBACK = process.env.UMBLER_NOTIF_ORG || 'aDjKophL8jEd_D8m';
export const UMBLER_FROM_FALLBACK = process.env.UMBLER_NOTIF_FROM || '5561998584761';

export interface UmblerAccount {
  organization_id: string;
  api_token: string;
  updated_at?: string | null;
}

/** Lê o registro único da conta (id=1). Retorna null se não existir. */
export async function getUmblerAccount(supabase: any): Promise<UmblerAccount | null> {
  try {
    const { data } = await supabase
      .schema('integrations')
      .from('umbler_account')
      .select('organization_id, api_token, updated_at')
      .eq('id', 1)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

/** Token da conta (banco) se preenchido; senão o do env. '' quando nenhum está setado. */
export async function getUmblerToken(supabase: any): Promise<string> {
  const acc = await getUmblerAccount(supabase);
  const t = (acc?.api_token || '').trim();
  return t.length > 0 ? t : UMBLER_TOKEN_ENV;
}

/** Org da conta (banco) → org do bar (arg) → fallback. */
export async function getUmblerOrg(supabase: any, barOrg?: string | null): Promise<string> {
  const acc = await getUmblerAccount(supabase);
  return (acc?.organization_id || barOrg || UMBLER_ORG_FALLBACK);
}

export function umblerAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
