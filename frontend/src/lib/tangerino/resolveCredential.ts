import { decryptSecretToString, isEncrypted } from '@/lib/crypto/secretBox';

/**
 * Resolver ÚNICO da credencial Tangerino (Sólides DP) — API de ponto/RH.
 * Token POR BAR (cada empresa tem o seu, vindo do suporte da Sólides). ENVELOPE-ONLY:
 * configuracoes.enc.token é cifrado com a chave-mestra do Vercel (lib/crypto/secretBox).
 *
 * Auth: a Tangerino usa `Authorization: Basic <token>` (o token já vem pronto — NÃO é
 * base64 de user:senha). Por isso o header é literal `Basic <token>`.
 */
export const TANGERINO = {
  employer: 'https://employer.tangerino.com.br',
  punch: 'https://api.tangerino.com.br/api/punch',
  report: 'https://api.tangerino.com.br/api/report',
} as const;

export interface ResolvedTangerino {
  id: number;
  token: string;
  empresaNome?: string | null;
}

export async function resolveTangerinoCredential(row: any): Promise<ResolvedTangerino> {
  if (!row) throw new Error('Credencial Tangerino não encontrada para este bar.');
  const enc = row.configuracoes?.enc;
  if (!enc || !isEncrypted(enc.token)) {
    throw new Error(
      `Credencial Tangerino ${row.id} não está cifrada (envelope). ` +
        'Cadastre o token via o cadastro de credenciais (configuracoes.enc.token).',
    );
  }
  return {
    id: row.id,
    token: decryptSecretToString(enc.token),
    empresaNome: row.empresa_nome ?? null,
  };
}

/** Header Authorization da Tangerino: `Basic <token>` (token já pronto).
 *  Sanitiza: tira espaços/quebras e um eventual prefixo "Basic " colado junto. */
export function tangerinoAuthHeader(token: string): string {
  const t = token.replace(/\s+/g, '').replace(/^Basic/i, '');
  return `Basic ${t}`;
}
