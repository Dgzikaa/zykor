import crypto from 'crypto';

/**
 * Envelope encryption (AES-256-GCM) para segredos de credenciais bancárias.
 *
 * A chave-mestra vive APENAS no Vercel (env var CREDENTIALS_MASTER_KEY, 32 bytes em base64,
 * flag "Sensitive"). NUNCA no Supabase, NUNCA no repo. Assim, um dump do banco ou acesso ao
 * dashboard do Supabase é inútil sozinho — o atacante precisaria também da chave do Vercel.
 *
 * Formato do payload: "v1:" + base64( iv(12) || authTag(16) || ciphertext )
 * O prefixo de versão permite rotacionar a chave/algoritmo no futuro.
 *
 * Gerar a chave-mestra (rode localmente, guarde no Vercel, NÃO commite):
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const ALG = 'aes-256-gcm';
const VERSION = 'v1';

function getKey(): Buffer {
  const b64 = process.env.CREDENTIALS_MASTER_KEY;
  if (!b64) {
    throw new Error('CREDENTIALS_MASTER_KEY não configurada (env do Vercel).');
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_MASTER_KEY inválida: precisa ser 32 bytes em base64.');
  }
  return key;
}

/** Criptografa string ou Buffer. Retorna "v1:<base64>". */
export function encryptSecret(plaintext: string | Buffer): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const pt = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
}

/** Descriptografa um payload "v1:<base64>" e devolve Buffer (use p/ cert/key binário). */
export function decryptSecret(payload: string): Buffer {
  const key = getKey();
  if (!payload || !payload.startsWith(`${VERSION}:`)) {
    throw new Error('Segredo em formato desconhecido (esperado prefixo v1:).');
  }
  const raw = Buffer.from(payload.slice(VERSION.length + 1), 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/** Conveniência: descriptografa e devolve string (p/ client_secret). */
export function decryptSecretToString(payload: string): string {
  return decryptSecret(payload).toString('utf8');
}

/** True se o valor está no formato cifrado (v1:...). */
export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${VERSION}:`);
}
