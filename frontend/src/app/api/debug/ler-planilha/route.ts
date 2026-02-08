import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = '1y4wR3dxIpfIkWQdPdfQ2V889p_NXIDCU1tGt2PWx57Y';

/**
 * Gerar JWT assinado para Google Service Account
 */
async function gerarJWT(clientEmail: string, privateKeyPem: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Base64URL encode
  const base64url = (data: Uint8Array): string => {
    const base64 = Buffer.from(data).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Importar chave privada
  const pemContent = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Buffer.from(pemContent, 'base64');
  
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign({
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  const signatureB64 = base64url(signature);
  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Obter access token do Google OAuth2
 */
async function obterAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await gerarJWT(clientEmail, privateKey);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao obter access token: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Buscar dados de uma aba específica
 */
async function buscarDadosAba(accessToken: string, aba: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(aba)}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao buscar aba ${aba}: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Listar todas as abas da planilha
 */
async function listarAbas(accessToken: string): Promise<string[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao listar abas: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.sheets?.map((s: any) => s.properties.title) || [];
}

/**
 * GET /api/debug/ler-planilha
 * Lê todas as abas da planilha e retorna o conteúdo
 */
export async function GET(request: NextRequest) {
  try {
    // Pegar credenciais da Service Account
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: 'GOOGLE_SERVICE_ACCOUNT_KEY não configurada' },
        { status: 500 }
      );
    }

    const credentials = JSON.parse(serviceAccountKey);
    const { client_email, private_key } = credentials;

    if (!client_email || !private_key) {
      return NextResponse.json(
        { error: 'Credenciais incompletas (falta client_email ou private_key)' },
        { status: 500 }
      );
    }

    // Obter access token
    const accessToken = await obterAccessToken(client_email, private_key);

    // Listar todas as abas
    const abas = await listarAbas(accessToken);
    console.log('Abas encontradas:', abas);

    // Buscar dados de cada aba
    const resultado: Record<string, any[][]> = {};
    
    for (const aba of abas) {
      try {
        const dados = await buscarDadosAba(accessToken, aba);
        resultado[aba] = dados;
        console.log(`Aba "${aba}": ${dados.length} linhas`);
      } catch (err) {
        console.error(`Erro ao ler aba "${aba}":`, err);
        resultado[aba] = [];
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheet_id: SPREADSHEET_ID,
      abas,
      dados: resultado
    });

  } catch (error) {
    console.error('Erro ao ler planilha:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
