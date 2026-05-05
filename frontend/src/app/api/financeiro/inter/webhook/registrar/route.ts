import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const WEBHOOK_TOKEN = process.env.INTER_WEBHOOK_TOKEN || '';

/**
 * Resolve a URL pública pra registrar como webhook no Inter.
 * Inter exige HTTPS válido — localhost / http não passa na validação.
 * Prioridade:
 *   1. INTER_WEBHOOK_PUBLIC_URL (env explícita, ideal pra ngrok em dev)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (auto em prod Vercel)
 *   3. NEXT_PUBLIC_APP_URL (se for https)
 *   4. fallback https://zykor.com.br
 */
function resolverBaseUrl(): string {
  const candidatos = [
    process.env.INTER_WEBHOOK_PUBLIC_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];
  for (const c of candidatos) {
    if (c && /^https:\/\//.test(c)) return c.replace(/\/$/, '');
    if (c && /^[\w.-]+\.[\w]+/.test(c) && !c.includes('localhost')) {
      // Sem protocolo: presume https
      return `https://${c.replace(/\/$/, '')}`;
    }
  }
  return 'https://zykor.com.br';
}

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadCert(supabase: any, configuracoes: any): Promise<{ cert: Buffer; key: Buffer } | null> {
  const certFile = configuracoes?.cert_file || configuracoes?.certificate_file;
  const keyFile = configuracoes?.key_file || configuracoes?.private_key_file;
  if (!certFile || !keyFile) return null;
  const { data: certBlob } = await supabase.storage.from('inter').download(certFile);
  const { data: keyBlob } = await supabase.storage.from('inter').download(keyFile);
  if (!certBlob || !keyBlob) return null;
  const cert = Buffer.from(await certBlob.arrayBuffer());
  const key = Buffer.from(await keyBlob.arrayBuffer());
  return { cert, key };
}

async function chamarInter(
  method: 'PUT' | 'GET' | 'DELETE',
  path: string,
  token: string,
  contaCorrente: string,
  mtls: { cert: Buffer; key: Buffer },
  body?: object
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payloadStr = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-conta-corrente': contaCorrente,
        ...(payloadStr ? { 'Content-Length': Buffer.byteLength(payloadStr) } : {}),
      },
      cert: mtls.cert,
      key: mtls.key,
    };
    const req = https.request(options, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => resolve({ statusCode: res.statusCode || 500, body: buf }));
    });
    req.on('error', reject);
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

/**
 * POST /api/financeiro/inter/webhook/registrar
 * Body: { bar_id, inter_credencial_id }
 *
 * Registra a URL pública do Zykor como webhook PIX no Inter.
 * Chamada manual (1x por credencial). Pode re-rodar pra atualizar URL.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = Number(body.bar_id);
    const credId = Number(body.inter_credencial_id);
    if (!Number.isFinite(barId) || !Number.isFinite(credId)) {
      return NextResponse.json({ error: 'bar_id e inter_credencial_id obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: cred, error } = await supabase
      .from('api_credentials')
      .select('id, client_id, client_secret, configuracoes')
      .eq('id', credId)
      .eq('bar_id', barId)
      .in('sistema', ['inter', 'banco_inter'])
      .single();
    if (error || !cred) {
      return NextResponse.json({ error: 'Credencial Inter não encontrada' }, { status: 404 });
    }

    const contaCorrente = cred.configuracoes?.conta_corrente;
    if (!contaCorrente) {
      return NextResponse.json({ error: 'conta_corrente não configurada' }, { status: 400 });
    }

    const mtls = await loadCert(supabase, cred.configuracoes);
    if (!mtls) {
      return NextResponse.json({ error: 'Certificados mTLS não encontrados no Storage' }, { status: 400 });
    }

    const token = await getInterAccessToken(
      cred.client_id,
      cred.client_secret,
      'pagamento-pix.write pagamento-pix.read webhook-banking.write webhook-banking.read',
      mtls
    );

    // Monta URL pública do webhook (com token compartilhado se houver)
    const baseUrl = resolverBaseUrl();
    const webhookUrl = WEBHOOK_TOKEN
      ? `${baseUrl}/api/financeiro/inter/webhook/pix?token=${encodeURIComponent(WEBHOOK_TOKEN)}`
      : `${baseUrl}/api/financeiro/inter/webhook/pix`;

    // Validação prévia: Inter exige HTTPS
    if (!/^https:\/\//.test(webhookUrl)) {
      return NextResponse.json(
        {
          error: `URL "${webhookUrl}" inválida. Inter exige HTTPS público.`,
          dica:
            'Em dev, defina INTER_WEBHOOK_PUBLIC_URL no .env.local (ex: ngrok). Em produção (Vercel), VERCEL_PROJECT_PRODUCTION_URL é setada automaticamente.',
        },
        { status: 400 }
      );
    }

    // PUT /banking/v2/webhooks/pix-pagamento — único tipo PIX disponível
    const resp = await chamarInter(
      'PUT',
      '/banking/v2/webhooks/pix-pagamento',
      token,
      contaCorrente,
      mtls,
      { webhookUrl }
    );

    if (resp.statusCode >= 400) {
      let body: any = resp.body;
      try {
        body = JSON.parse(resp.body);
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        {
          error: 'Inter rejeitou o registro',
          inter_status: resp.statusCode,
          inter_body: body,
          webhookUrl,
        },
        { status: resp.statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      webhookUrl,
      tipo_webhook: 'pix-pagamento',
      inter_status: resp.statusCode,
    });
  } catch (e: any) {
    console.error('[INTER-WEBHOOK-REG] Erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

/**
 * GET /api/financeiro/inter/webhook/registrar?bar_id=X&inter_credencial_id=Y
 * Consulta o webhook atual registrado no Inter.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = Number(searchParams.get('bar_id'));
    const credId = Number(searchParams.get('inter_credencial_id'));
    if (!Number.isFinite(barId) || !Number.isFinite(credId)) {
      return NextResponse.json({ error: 'bar_id e inter_credencial_id obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: cred } = await supabase
      .from('api_credentials')
      .select('id, client_id, client_secret, configuracoes')
      .eq('id', credId)
      .eq('bar_id', barId)
      .single();
    if (!cred) return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 });

    const contaCorrente = cred.configuracoes?.conta_corrente;
    const mtls = await loadCert(supabase, cred.configuracoes);
    if (!mtls || !contaCorrente) {
      return NextResponse.json({ error: 'Credencial incompleta' }, { status: 400 });
    }

    const token = await getInterAccessToken(
      cred.client_id,
      cred.client_secret,
      'pagamento-pix.write pagamento-pix.read webhook-banking.write webhook-banking.read',
      mtls
    );

    const tipos = ['pix-pagamento', 'pagamento-pix', 'pix'];
    const resultados: Array<{ tipo: string; status: number; body: any }> = [];
    for (const tipo of tipos) {
      const r = await chamarInter('GET', `/banking/v2/webhooks/${tipo}`, token, contaCorrente, mtls);
      resultados.push({ tipo, status: r.statusCode, body: r.body ? safeJson(r.body) : null });
    }
    return NextResponse.json({ resultados });
  } catch (e: any) {
    console.error('[INTER-WEBHOOK-GET] Erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
