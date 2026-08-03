import https from 'https';
import { getInterCertificates } from './certificates';

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenCacheEntry>();
/**
 * Requisições de token EM VOO, por chave. Sem isto, um lote de pagamentos disparado junto
 * com o cache frio vira N chamadas simultâneas ao /oauth/v2/token — o Inter derruba as
 * excedentes devolvendo corpo VAZIO, e o financeiro via "Inter indisponível" em todos.
 * Aconteceu em 03/08/2026 16:25 (16 falhas em 10s, mesmo trace; 5 min depois funcionou).
 * Com o coalescing, N chamadas concorrentes compartilham UMA requisição.
 */
const tokenInFlight = new Map<string, Promise<string>>();

export function clearInterTokenCache(): void {
  tokenCache.clear();
  tokenInFlight.clear();
  console.log('🔐 Cache de tokens Inter limpo');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Uma tentativa de OAuth. Resolve o token ou rejeita com erro já contextualizado. */
function pedirToken(
  clientId: string,
  clientSecret: string,
  scope: string,
  cert: Buffer,
  key: Buffer,
): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const data = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  }).toString();

  const options = {
    hostname: 'cdpj.partners.bancointer.com.br',
    port: 443,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data),
    },
    cert,
    key,
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      const status = response.statusCode ?? 0;
      let body = '';
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => {
        // O status ENTRA na mensagem de erro. Antes ele só ia pro console.log (nível info,
        // que a Vercel não retém), então o erro que sobrava era "Erro ao parsear resposta: "
        // sem corpo e sem status — impossível saber se era rate limit, 5xx ou credencial.
        const trecho = body.trim().slice(0, 200);
        if (!body.trim()) {
          reject(new Error(`Inter OAuth HTTP ${status}: resposta vazia`));
          return;
        }
        let parsed: any;
        try {
          parsed = JSON.parse(body);
        } catch {
          reject(new Error(`Inter OAuth HTTP ${status}: resposta ilegível: ${trecho}`));
          return;
        }
        if (!parsed?.access_token) {
          reject(new Error(`Inter OAuth HTTP ${status}: sem access_token: ${trecho}`));
          return;
        }
        console.log('🔐 Token obtido. Scope:', parsed.scope, 'expira_em:', parsed.expires_in);
        resolve(parsed);
      });
    });

    // Sem timeout a requisição podia pendurar até o limite da função inteira.
    request.setTimeout(20_000, () => {
      request.destroy(new Error('Inter OAuth: timeout de 20s ao pedir token'));
    });
    request.on('error', (error) => reject(error));
    request.write(data);
    request.end();
  });
}

/** Falha transitória do lado do Inter (vale re-tentar) vs. erro definitivo (credencial/cert). */
function ehTransitorio(msg: string): boolean {
  if (/resposta vazia|resposta ileg[íi]vel|timeout/i.test(msg)) return true;
  const m = msg.match(/HTTP (\d{3})/);
  if (!m) return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(msg);
  const status = Number(m[1]);
  return status === 429 || status >= 500;
}

export async function getInterAccessToken(
  clientId: string,
  clientSecret: string,
  scope: string = 'pagamento-pix.write',
  mtlsCredentials?: { cert: Buffer; key: Buffer }
): Promise<string> {
  const cacheKey = `${clientId}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    console.log('🔐 Usando token em cache da credencial');
    return cached.token;
  }

  // Já tem alguém buscando este mesmo token? Entra na carona em vez de abrir outra conexão.
  const emVoo = tokenInFlight.get(cacheKey);
  if (emVoo) {
    console.log('🔐 Token já está sendo obtido — aguardando a requisição em voo');
    return emVoo;
  }

  const { cert, key } = mtlsCredentials || getInterCertificates();
  console.log('🔐 OAuth2 Inter:', { grant_type: 'client_credentials', scope });

  const promessa = (async () => {
    // Retry só aqui: pedir TOKEN é idempotente. O POST do pagamento NUNCA é re-tentado
    // automaticamente — repetir pagamento duplica PIX/dinheiro.
    const MAX = 3;
    let ultimoErro: Error | null = null;
    for (let tentativa = 1; tentativa <= MAX; tentativa++) {
      try {
        const parsed = await pedirToken(clientId, clientSecret, scope, cert, key);
        tokenCache.set(cacheKey, {
          token: parsed.access_token,
          expiresAt: Date.now() + parsed.expires_in * 1000,
        });
        console.log('✅ Token obtido com sucesso via mTLS');
        return parsed.access_token;
      } catch (e: unknown) {
        const erro = e instanceof Error ? e : new Error(String(e));
        ultimoErro = erro;
        if (tentativa >= MAX || !ehTransitorio(erro.message)) break;
        const espera = 400 * 2 ** (tentativa - 1); // 400ms, 800ms
        console.log(`⚠️ Token Inter falhou (${erro.message}) — tentativa ${tentativa}/${MAX}, aguardando ${espera}ms`);
        await sleep(espera);
      }
    }
    throw ultimoErro ?? new Error('Inter OAuth: falha desconhecida ao obter token');
  })();

  tokenInFlight.set(cacheKey, promessa);
  try {
    return await promessa;
  } finally {
    tokenInFlight.delete(cacheKey); // libera pra próxima janela (sucesso ou falha)
  }
}
