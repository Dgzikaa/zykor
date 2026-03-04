import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import crypto from 'crypto';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getInterCredentials(barId: number, credentialId?: number) {
  let query = supabase
    .from('api_credentials')
    .select('*')
    .eq('bar_id', barId)
    .in('sistema', ['inter', 'banco_inter'])
    .eq('ativo', true);

  if (credentialId) {
    query = query.eq('id', credentialId);
  } else {
    query = query.order('id', { ascending: true }).limit(1);
  }

  const { data, error } = await query;
  if (error || !data?.[0]) return null;
  return data[0];
}

async function loadMtlSCredentials(configuracoes: any) {
  const certFile =
    configuracoes?.cert_file ||
    configuracoes?.cert_path ||
    configuracoes?.certificate_file ||
    null;
  const keyFile =
    configuracoes?.key_file ||
    configuracoes?.key_path ||
    configuracoes?.private_key_file ||
    null;

  if (!certFile || !keyFile) {
    return { certFile, keyFile, cert: null as Buffer | null, key: null as Buffer | null };
  }

  const { data: certBlob, error: certError } = await supabase.storage.from('inter').download(certFile);
  const { data: keyBlob, error: keyError } = await supabase.storage.from('inter').download(keyFile);

  if (certError || keyError || !certBlob || !keyBlob) {
    return {
      certFile,
      keyFile,
      cert: null as Buffer | null,
      key: null as Buffer | null,
      certError: certError?.message || null,
      keyError: keyError?.message || null,
    };
  }

  return {
    certFile,
    keyFile,
    cert: Buffer.from(await certBlob.arrayBuffer()),
    key: Buffer.from(await keyBlob.arrayBuffer()),
    certError: null,
    keyError: null,
  };
}

async function probePixAuth(token: string, contaCorrente: string, cert: Buffer, key: Buffer) {
  const payload = '{}'; // Prova de autenticação sem execução de pagamento válido.
  const options = {
    hostname: 'cdpj.partners.bancointer.com.br',
    port: 443,
    path: '/banking/v2/pix',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'x-conta-corrente': contaCorrente,
      'x-id-idempotente': crypto.randomUUID(),
      'Content-Length': Buffer.byteLength(payload),
    },
    cert,
    key,
  };

  return new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () =>
        resolve({
          statusCode: res.statusCode || 0,
          body,
        })
      );
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number.parseInt(String(body?.bar_id || ''), 10);
    const credentialId = Number.parseInt(String(body?.inter_credencial_id || ''), 10);

    if (!Number.isFinite(barId)) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const cred = await getInterCredentials(
      barId,
      Number.isFinite(credentialId) ? credentialId : undefined
    );
    if (!cred) {
      return NextResponse.json(
        { success: false, error: 'Credencial Inter não encontrada para o bar informado' },
        { status: 404 }
      );
    }

    const contaCorrente = cred.configuracoes?.conta_corrente || null;
    const mtls = await loadMtlSCredentials(cred.configuracoes);

    const report: any = {
      credencial: {
        id: cred.id,
        empresa_nome: cred.empresa_nome || null,
        sistema: cred.sistema || null,
        bar_id: cred.bar_id,
        conta_corrente: contaCorrente,
        client_id_tail: cred.client_id ? String(cred.client_id).slice(-8) : null,
        client_secret_present: !!cred.client_secret,
        cert_file: mtls.certFile || null,
        key_file: mtls.keyFile || null,
      },
      checks: {
        has_client_id: !!cred.client_id,
        has_client_secret: !!cred.client_secret,
        has_conta_corrente: !!contaCorrente,
        has_cert_file: !!mtls.certFile,
        has_key_file: !!mtls.keyFile,
        cert_download_ok: !!mtls.cert,
        key_download_ok: !!mtls.key,
        cert_size_bytes: mtls.cert?.length || 0,
        key_size_bytes: mtls.key?.length || 0,
      },
      errors: {
        cert_download_error: mtls.certError || null,
        key_download_error: mtls.keyError || null,
      },
      token: {
        success: false,
        scope: 'pagamento-pix.write',
        error: null as string | null,
      },
      pix_probe: {
        attempted: false,
        status_code: 0,
        body: null as string | null,
      },
      diagnosis: '',
    };

    if (!cred.client_id || !cred.client_secret || !contaCorrente || !mtls.cert || !mtls.key) {
      report.diagnosis =
        'Credencial incompleta: falta client_id/client_secret/conta_corrente/certificado/chave.';
      return NextResponse.json({ success: true, report });
    }

    try {
      const token = await getInterAccessToken(
        cred.client_id,
        cred.client_secret,
        'pagamento-pix.write',
        { cert: mtls.cert, key: mtls.key }
      );
      report.token.success = true;
      report.token.token_tail = token.slice(-8);

      report.pix_probe.attempted = true;
      const probe = await probePixAuth(token, contaCorrente, mtls.cert, mtls.key);
      report.pix_probe.status_code = probe.statusCode;
      report.pix_probe.body = probe.body;

      if (probe.statusCode === 401 && /login\/senha invalido|acesso negado/i.test(probe.body)) {
        report.diagnosis =
          'Token OAuth foi emitido, mas Banking PIX negou autenticação. Geralmente indica vínculo incorreto entre app, conta corrente e/ou par cert/key no Inter.';
      } else if (probe.statusCode >= 200 && probe.statusCode < 500) {
        report.diagnosis =
          'Autenticação mTLS/OAuth aparentemente válida no Banking. Erros subsequentes tendem a ser de regra de negócio/payload.';
      } else {
        report.diagnosis =
          'Falha de comunicação com Inter durante prova Banking PIX. Verifique rede/ambiente/instabilidade.';
      }
    } catch (error) {
      report.token.error = error instanceof Error ? error.message : 'Erro desconhecido ao obter token';
      report.diagnosis =
        'Falha ao obter token OAuth com mTLS. Verifique client_id/client_secret e par cert/key da credencial.';
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

