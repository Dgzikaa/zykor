import { decryptSecret, decryptSecretToString, isEncrypted } from '@/lib/crypto/secretBox';

/**
 * Resolver ÚNICO de credencial Inter. Toda rota que precisa de client_secret + cert/key
 * deve passar por aqui — nunca ler `client_secret` nem baixar cert de bucket.
 *
 * ENVELOPE-ONLY (sem fallback): configuracoes.enc = { client_secret, cert, key } cifrados
 * com a chave-mestra do Vercel (ver lib/crypto/secretBox). Não há caminho que leia segredo
 * utilizável a partir do Supabase — nem coluna em texto, nem bucket. Se a credencial não
 * estiver no formato envelope, falha de propósito.
 */

export interface ResolvedInterCredential {
  id: number;
  clientId: string;
  clientSecret: string;
  contaCorrente?: string;
  mtls: { cert: Buffer; key: Buffer };
  empresaNome?: string | null;
  cnpj?: string | null;
}

/**
 * Recebe uma linha de api_credentials já buscada e devolve o material descriptografado.
 * Lança erro claro se a credencial não estiver cifrada (envelope) ou faltar peça.
 */
export async function resolveInterCredential(row: any): Promise<ResolvedInterCredential> {
  if (!row) throw new Error('Credencial Inter não encontrada.');

  const enc = row.configuracoes?.enc;
  if (!enc || !isEncrypted(enc.client_secret) || !isEncrypted(enc.cert) || !isEncrypted(enc.key)) {
    throw new Error(
      `Credencial Inter ${row.id} não está no formato cifrado (envelope). ` +
        'Recadastre via scripts/cadastrar-credencial-inter.mjs.'
    );
  }
  if (!row.client_id) throw new Error(`Credencial Inter ${row.id} sem client_id.`);

  return {
    id: row.id,
    clientId: row.client_id,
    clientSecret: decryptSecretToString(enc.client_secret),
    contaCorrente: row.configuracoes?.conta_corrente || undefined,
    mtls: { cert: decryptSecret(enc.cert), key: decryptSecret(enc.key) },
    empresaNome: row.empresa_nome ?? null,
    cnpj: row.empresa_cnpj ?? null,
  };
}
