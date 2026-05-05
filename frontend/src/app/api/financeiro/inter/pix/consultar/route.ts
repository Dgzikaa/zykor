import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/financeiro/inter/pix/consultar?bar_id=X&codigo=UUID&inter_credencial_id=Y
 *
 * Consulta o status detalhado de um PIX direto na API do Inter.
 * Retorna data, status real, etc. — útil pra confirmar se realmente foi agendado.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = Number(searchParams.get('bar_id'));
    const codigo = searchParams.get('codigo');
    const credId = Number(searchParams.get('inter_credencial_id'));

    if (!Number.isFinite(barId) || !codigo) {
      return NextResponse.json({ error: 'bar_id e codigo obrigatórios' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let credQuery = supabase
      .from('api_credentials')
      .select('id, client_id, client_secret, configuracoes')
      .eq('bar_id', barId)
      .in('sistema', ['inter', 'banco_inter'])
      .eq('ativo', true);
    if (Number.isFinite(credId)) credQuery = credQuery.eq('id', credId);
    const { data: cred } = await credQuery.limit(1).maybeSingle();
    if (!cred) {
      return NextResponse.json({ error: 'Credencial Inter não encontrada' }, { status: 404 });
    }

    const contaCorrente = cred.configuracoes?.conta_corrente;
    const certFile = cred.configuracoes?.cert_file;
    const keyFile = cred.configuracoes?.key_file;
    if (!contaCorrente || !certFile || !keyFile) {
      return NextResponse.json({ error: 'Credencial incompleta' }, { status: 400 });
    }

    const { data: certBlob } = await supabase.storage.from('inter').download(certFile);
    const { data: keyBlob } = await supabase.storage.from('inter').download(keyFile);
    if (!certBlob || !keyBlob) {
      return NextResponse.json({ error: 'Cert/key não encontrados' }, { status: 400 });
    }
    const cert = Buffer.from(await certBlob.arrayBuffer());
    const key = Buffer.from(await keyBlob.arrayBuffer());

    const token = await getInterAccessToken(
      cred.client_id,
      cred.client_secret,
      'pagamento-pix.read pagamento-pix.write',
      { cert, key }
    );

    const resp = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'cdpj.partners.bancointer.com.br',
          port: 443,
          path: `/banking/v2/pix/${codigo}`,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            'x-conta-corrente': contaCorrente,
            'Content-Type': 'application/json',
          },
          cert,
          key,
        },
        r => {
          let buf = '';
          r.on('data', c => (buf += c));
          r.on('end', () => resolve({ statusCode: r.statusCode || 500, body: buf }));
        }
      );
      req.on('error', reject);
      req.end();
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(resp.body);
    } catch {
      parsed = resp.body;
    }

    return NextResponse.json({
      inter_status_http: resp.statusCode,
      inter_response: parsed,
    });
  } catch (err: any) {
    console.error('[INTER-CONSULTAR] Erro:', err);
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 });
  }
}
