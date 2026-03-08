import https from 'https';
import { getInterCertificates } from './certificates';

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCacheEntry>();

export function clearInterTokenCache(): void {
  tokenCache.clear();
  console.log('🔐 Cache de tokens Inter limpo');
}

export async function getInterAccessToken(
  clientId: string,
  clientSecret: string,
  scope: string = 'pagamento-pix.write',
  mtlsCredentials?: { cert: Buffer; key: Buffer }
): Promise<string> {
  const now = Date.now();
  const cacheKey = `${clientId}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && now < cached.expiresAt - 30_000) {
    console.log('🔐 Usando token em cache da credencial');
    return cached.token;
  }

  console.log('🔐 Obtendo novo token de acesso via mTLS...');

  // Carregar certificados PEM usando função centralizada
  const { cert, key } = mtlsCredentials || getInterCertificates();

  // Preparar dados para OAuth2
  const data = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: scope,
  }).toString();

  console.log('🔐 Dados OAuth2:', {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret.substring(0, 8) + '...',
    scope: scope,
  });

  // Configurar requisição HTTPS com mTLS (produção)
  const options = {
    hostname: 'cdpj.partners.bancointer.com.br',
    port: 443,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data),
    },
    cert: cert,
    key: key,
  };

  // Fazer requisição HTTPS
  const token = await new Promise<string>((resolve, reject) => {
    const request = https.request(options, response => {
      console.log('📡 Status da resposta:', response.statusCode);
      console.log('📡 Headers da resposta:', response.headers);

      let body = '';
      response.on('data', chunk => (body += chunk));
      response.on('end', () => {
        console.log('📡 Corpo da resposta:', body);

        try {
          const parsed = JSON.parse(body);
          console.log('🔐 Resposta completa do token:', parsed);
          if (parsed.access_token) {
            console.log(
              '🔐 Token obtido com sucesso:',
              parsed.access_token.substring(0, 20) + '...'
            );
            console.log('🔐 Scope do token:', parsed.scope);
            console.log('🔐 Expira em:', parsed.expires_in, 'segundos');

            // Cache do token por credencial + escopo
            tokenCache.set(cacheKey, {
              token: parsed.access_token,
              expiresAt: now + parsed.expires_in * 1000,
            });

            resolve(parsed.access_token);
          } else {
            console.log('❌ Resposta sem access_token:', parsed);
            reject(new Error('Token não encontrado na resposta'));
          }
        } catch (error) {
          console.log('❌ Erro ao parsear resposta:', error);
          reject(new Error(`Erro ao parsear resposta: ${body}`));
        }
      });
    });

    request.on('error', error => {
      console.log('❌ Erro na requisição HTTPS:', error);
      reject(error);
    });

    request.write(data);
    request.end();
  });

  console.log('✅ Token obtido com sucesso via mTLS');
  return token;
}
