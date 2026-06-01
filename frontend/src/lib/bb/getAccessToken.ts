import https from 'https';
import type { MtlsCredentials } from './certificates';

/**
 * OAuth2 client_credentials do Banco do Brasil.
 *
 * Diferenças vs Inter:
 *  - Autenticação via header Basic base64(client_id:client_secret) (Inter manda no corpo)
 *  - mTLS com Certificado A1 (mesma mecânica de cert+key do Inter)
 *  - As chamadas de API (não o token) exigem ?gw-dev-app-key=... (chave do app no Portal Developers)
 *
 * Hosts:
 *  - prod:    oauth.bb.com.br
 *  - sandbox: oauth.sandbox.bb.com.br
 *
 * TODO(swagger BB): confirmar o path do token e os scopes exatos no Portal Developers
 * quando o acesso estiver liberado. Os abaixo são os documentados publicamente.
 */

type TokenCacheEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenCacheEntry>();

export function clearBBTokenCache(): void {
  tokenCache.clear();
}

export interface BBAuthParams {
  clientId: string;
  clientSecret: string;
  /** Escopos separados por espaço. Ex.: "pagamentos-lote.requisicao-pagamentos pagamentos-lote.lotes-info" */
  scope: string;
  mtls: MtlsCredentials;
  ambiente: 'producao' | 'sandbox';
}

function hosts(ambiente: 'producao' | 'sandbox') {
  return ambiente === 'sandbox'
    ? { oauth: 'oauth.sandbox.bb.com.br' }
    : { oauth: 'oauth.bb.com.br' };
}

export async function getBBAccessToken(params: BBAuthParams): Promise<string> {
  const { clientId, clientSecret, scope, mtls, ambiente } = params;

  const now = Date.now();
  const cacheKey = `${ambiente}:${clientId}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && now < cached.expiresAt - 30_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope,
  }).toString();

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const options: https.RequestOptions = {
    hostname: hosts(ambiente).oauth,
    port: 443,
    path: '/oauth/token', // TODO(swagger BB): confirmar (algumas versões usam /oauth/token)
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    cert: mtls.cert,
    key: mtls.key,
  };

  const token = await new Promise<string>((resolve, reject) => {
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.access_token) {
            tokenCache.set(cacheKey, {
              token: parsed.access_token,
              expiresAt: now + (parsed.expires_in ?? 600) * 1000,
            });
            resolve(parsed.access_token);
          } else {
            reject(new Error(`Token BB não retornado: ${raw}`));
          }
        } catch {
          reject(new Error(`Resposta OAuth BB inválida: ${raw}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  return token;
}
