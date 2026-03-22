import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { getInterCertificates } from '@/lib/inter/certificates';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// URL do webhook no Supabase
const WEBHOOK_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/inter-pix-webhook';

// Função para obter credenciais do Inter
async function getInterCredentials(barId: number) {
  const { data: credencial, error } = await supabase
    .from('api_credentials')
    .select('*')
    .eq('bar_id', barId)
    .in('sistema', ['inter', 'banco_inter'])
    .eq('ativo', true)
    .limit(1)
    .single();

  if (error || !credencial) {
    console.error('[INTER-WEBHOOK] Erro ao buscar credenciais:', error);
    return null;
  }

  return credencial;
}

// Função para obter token OAuth com mTLS
async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const { cert, key } = getInterCertificates();

  const data = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'webhook.write',
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
    cert: cert,
    key: key,
  };

  return new Promise<string>((resolve, reject) => {
    const request = https.request(options, response => {
      let body = '';
      response.on('data', chunk => (body += chunk));
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error(`Token não encontrado: ${body}`));
          }
        } catch (error) {
          reject(new Error(`Erro ao parsear resposta: ${body}`));
        }
      });
    });

    request.on('error', error => reject(error));
    request.write(data);
    request.end();
  });
}

// Função para registrar webhook no Inter
async function registrarWebhook(
  accessToken: string, 
  chavePix: string, 
  webhookUrl: string,
  contaCorrente?: string
): Promise<{ success: boolean; error?: string }> {
  const { cert, key } = getInterCertificates();

  const body = JSON.stringify({ webhookUrl });

  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Authorization': `Bearer ${accessToken}`,
  };

  // Adicionar conta corrente se fornecida
  if (contaCorrente) {
    headers['x-conta-corrente'] = contaCorrente;
  }

  // Formatar chave PIX (remover + do telefone se houver)
  const chaveFormatada = chavePix.replace(/^\+/, '');

  const options = {
    hostname: 'cdpj.partners.bancointer.com.br',
    port: 443,
    path: `/pix/v2/webhook/${encodeURIComponent(chaveFormatada)}`,
    method: 'PUT',
    headers,
    cert: cert,
    key: key,
  };

  return new Promise((resolve) => {
    const request = https.request(options, response => {
      let responseBody = '';
      response.on('data', chunk => (responseBody += chunk));
      response.on('end', () => {
        if (response.statusCode === 204) {
          resolve({ success: true });
        } else if (response.statusCode === 200) {
          resolve({ success: true });
        } else {
          resolve({ 
            success: false, 
            error: `Status ${response.statusCode}: ${responseBody}` 
          });
        }
      });
    });

    request.on('error', error => {
      resolve({ success: false, error: error.message });
    });

    request.write(body);
    request.end();
  });
}

// Função para consultar webhook cadastrado
async function consultarWebhook(
  accessToken: string, 
  chavePix: string,
  contaCorrente?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const { cert, key } = getInterCertificates();

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
  };

  if (contaCorrente) {
    headers['x-conta-corrente'] = contaCorrente;
  }

  const chaveFormatada = chavePix.replace(/^\+/, '');

  const options = {
    hostname: 'cdpj.partners.bancointer.com.br',
    port: 443,
    path: `/pix/v2/webhook/${encodeURIComponent(chaveFormatada)}`,
    method: 'GET',
    headers,
    cert: cert,
    key: key,
  };

  return new Promise((resolve) => {
    const request = https.request(options, response => {
      let responseBody = '';
      response.on('data', chunk => (responseBody += chunk));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const data = JSON.parse(responseBody);
            resolve({ success: true, data });
          } catch {
            resolve({ success: true, data: responseBody });
          }
        } else {
          resolve({ 
            success: false, 
            error: `Status ${response.statusCode}: ${responseBody}` 
          });
        }
      });
    });

    request.on('error', error => {
      resolve({ success: false, error: error.message });
    });

    request.end();
  });
}

// POST - Registrar webhook no Inter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, chave_pix } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!chave_pix) {
      return NextResponse.json(
        { success: false, error: 'chave_pix é obrigatória (chave PIX do bar para receber callbacks)' },
        { status: 400 }
      );
    }

    // Buscar credenciais
    const credenciais = await getInterCredentials(bar_id);
    
    if (!credenciais) {
      return NextResponse.json(
        { success: false, error: 'Credenciais Inter não encontradas para este bar' },
        { status: 400 }
      );
    }

    const clientId = credenciais.client_id;
    const clientSecret = credenciais.client_secret;
    const contaCorrente = credenciais.configuracoes?.conta_corrente;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { success: false, error: 'Credenciais Inter incompletas' },
        { status: 400 }
      );
    }

    // 1. Obter token com scope webhook.write
    const accessToken = await getAccessToken(clientId, clientSecret);

    // 2. Registrar webhook
    const resultado = await registrarWebhook(
      accessToken,
      chave_pix,
      WEBHOOK_URL,
      contaCorrente
    );

    if (!resultado.success) {
      return NextResponse.json(
        { success: false, error: resultado.error },
        { status: 400 }
      );
    }

    // 3. Salvar configuração no banco
    await supabase
      .from('api_credentials')
      .update({
        configuracoes: {
          ...credenciais.configuracoes,
          webhook_url: WEBHOOK_URL,
          webhook_chave_pix: chave_pix,
          webhook_cadastrado_em: new Date().toISOString()
        }
      })
      .eq('id', credenciais.id);

    return NextResponse.json({
      success: true,
      message: 'Webhook registrado com sucesso no Inter',
      data: {
        webhook_url: WEBHOOK_URL,
        chave_pix: chave_pix,
        bar_id: bar_id
      }
    });

  } catch (error: any) {
    console.error('[INTER-WEBHOOK] Erro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

// GET - Consultar webhook cadastrado
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '0');
    const chavePix = searchParams.get('chave_pix');

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar credenciais
    const credenciais = await getInterCredentials(barId);
    
    if (!credenciais) {
      return NextResponse.json(
        { success: false, error: 'Credenciais Inter não encontradas' },
        { status: 400 }
      );
    }

    // Se não passou chave_pix, retornar configuração salva
    if (!chavePix) {
      return NextResponse.json({
        success: true,
        data: {
          webhook_url: credenciais.configuracoes?.webhook_url || null,
          webhook_chave_pix: credenciais.configuracoes?.webhook_chave_pix || null,
          webhook_cadastrado_em: credenciais.configuracoes?.webhook_cadastrado_em || null
        }
      });
    }

    // Se passou chave_pix, consultar no Inter
    const clientId = credenciais.client_id;
    const clientSecret = credenciais.client_secret;
    const contaCorrente = credenciais.configuracoes?.conta_corrente;

    const accessToken = await getAccessToken(clientId, clientSecret);
    const resultado = await consultarWebhook(accessToken, chavePix, contaCorrente);

    return NextResponse.json({
      success: resultado.success,
      data: resultado.data,
      error: resultado.error
    });

  } catch (error: any) {
    console.error('[INTER-WEBHOOK] Erro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

// DELETE - Remover webhook
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '0');
    const chavePix = searchParams.get('chave_pix');

    if (!barId || !chavePix) {
      return NextResponse.json(
        { success: false, error: 'bar_id e chave_pix são obrigatórios' },
        { status: 400 }
      );
    }

    const credenciais = await getInterCredentials(barId);
    
    if (!credenciais) {
      return NextResponse.json(
        { success: false, error: 'Credenciais Inter não encontradas' },
        { status: 400 }
      );
    }

    const { cert, key } = getInterCertificates();
    const clientId = credenciais.client_id;
    const clientSecret = credenciais.client_secret;
    const contaCorrente = credenciais.configuracoes?.conta_corrente;

    // Obter token
    const accessToken = await getAccessToken(clientId, clientSecret);

    // Deletar webhook
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
    };

    if (contaCorrente) {
      headers['x-conta-corrente'] = contaCorrente;
    }

    const chaveFormatada = chavePix.replace(/^\+/, '');

    const resultado = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const options = {
        hostname: 'cdpj.partners.bancointer.com.br',
        port: 443,
        path: `/pix/v2/webhook/${encodeURIComponent(chaveFormatada)}`,
        method: 'DELETE',
        headers,
        cert: cert,
        key: key,
      };

      const req = https.request(options, response => {
        let body = '';
        response.on('data', chunk => (body += chunk));
        response.on('end', () => {
          if (response.statusCode === 204 || response.statusCode === 200) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `Status ${response.statusCode}: ${body}` });
          }
        });
      });

      req.on('error', error => resolve({ success: false, error: error.message }));
      req.end();
    });

    if (!resultado.success) {
      return NextResponse.json(
        { success: false, error: resultado.error },
        { status: 400 }
      );
    }

    // Limpar configuração no banco
    await supabase
      .from('api_credentials')
      .update({
        configuracoes: {
          ...credenciais.configuracoes,
          webhook_url: null,
          webhook_chave_pix: null,
          webhook_removido_em: new Date().toISOString()
        }
      })
      .eq('id', credenciais.id);

    return NextResponse.json({
      success: true,
      message: 'Webhook removido com sucesso'
    });

  } catch (error: any) {
    console.error('[INTER-WEBHOOK] Erro:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
