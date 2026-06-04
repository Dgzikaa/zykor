import { decryptSecretToString, isEncrypted } from '@/lib/crypto/secretBox';

/**
 * Resolver ÚNICO de credencial Stone (Cliente Stone / API de Conciliação).
 * Toda rota que precisa da chave do Portal Stone passa por aqui — nunca lê a
 * chave em texto. ENVELOPE-ONLY (sem fallback): configuracoes.enc.api_key é
 * cifrado com a chave-mestra do Vercel (ver lib/crypto/secretBox).
 *
 * A chave do Portal está amarrada ao CNPJ e vale p/ todos os StoneCodes daquele
 * documento — por isso `stoneCodes` é uma lista (guardada em texto, não é segredo).
 */

export interface ResolvedStoneCredential {
  id: number;
  apiKey: string;        // chave do Portal Stone (User do Basic Auth; Password vazio)
  stoneCodes: string[];  // affiliationCodes do bar
  empresaNome?: string | null;
  cnpj?: string | null;
}

export async function resolveStoneCredential(row: any): Promise<ResolvedStoneCredential> {
  if (!row) throw new Error('Credencial Stone não encontrada.');

  const enc = row.configuracoes?.enc;
  if (!enc || !isEncrypted(enc.api_key)) {
    throw new Error(
      `Credencial Stone ${row.id} não está no formato cifrado (envelope). ` +
        'Recadastre via scripts/cadastrar-credencial-stone.mjs.'
    );
  }

  const stoneCodes: string[] = (row.configuracoes?.stone_codes ?? [])
    .map((c: any) => String(c).trim())
    .filter(Boolean);
  if (stoneCodes.length === 0) {
    throw new Error(`Credencial Stone ${row.id} sem stone_codes em configuracoes.`);
  }

  return {
    id: row.id,
    apiKey: decryptSecretToString(enc.api_key),
    stoneCodes,
    empresaNome: row.empresa_nome ?? null,
    cnpj: row.empresa_cnpj ?? null,
  };
}

/**
 * Monta o header Authorization do Cliente Stone: Basic base64("<chave>:").
 * A chave é o User; o Password é VAZIO (dois-pontos sem nada depois).
 */
export function stoneBasicAuthHeader(apiKey: string): string {
  return 'Basic ' + Buffer.from(`${apiKey}:`, 'utf8').toString('base64');
}
