import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { encryptSecret } from '@/lib/crypto/secretBox';
import { resolveInterCredential } from '@/lib/inter/resolveCredential';
import { getInterAccessToken } from '@/lib/inter/getAccessToken';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

/**
 * Status (não-sensível) da credencial Inter de um bar.
 * NUNCA retorna client_secret/cert/key — esses só existem cifrados e só são
 * descriptografados server-side no momento do uso (resolveInterCredential).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = Number.parseInt(searchParams.get('bar_id') || '', 10);

    if (!Number.isFinite(barId)) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('api_credentials')
      .select('id, empresa_nome, empresa_cnpj, configuracoes, ativo')
      .eq('bar_id', barId)
      .in('sistema', ['inter', 'banco_inter'])
      .eq('ativo', true)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const data_safe = (data || []).map((row: any) => ({
      id: row.id,
      empresa_nome: row.empresa_nome || `Inter #${row.id}`,
      cnpj: row.empresa_cnpj || null,
      conta_corrente: row.configuracoes?.conta_corrente || null,
      // só indicadores — nenhum segredo
      formato: row.configuracoes?.enc ? 'envelope' : 'não-cifrado',
      configurado: !!(row.client_id || row.configuracoes?.enc),
    }));

    // Sem credencial ainda = lista vazia (a tela de cadastro trata isso), não é erro.
    return NextResponse.json({ success: true, data: data_safe });
  } catch (error) {
    console.error('❌ Erro ao buscar credenciais:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * POST — cadastra/atualiza a credencial Inter de um bar (self-serve, só admin).
 * Recebe client_id/client_secret/cert(PEM)/key(PEM)/conta_corrente e CIFRA no servidor
 * (envelope encryption, CREDENTIALS_MASTER_KEY só no Vercel). O banco só recebe texto cifrado.
 * Substitui o script scripts/cadastrar-credencial-inter.mjs. Passe `id` p/ atualizar uma existente.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if ((user.role as string) !== 'admin') {
    return NextResponse.json({ success: false, error: 'Apenas admin pode cadastrar credenciais bancárias.' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  // ---- TESTAR CONEXÃO ---- exercita OAuth + mTLS no Inter (sem pagar nada). Confirma se o
  // certificado/chave e o client_id/secret batem antes de sair pagando.
  if (body.action === 'testar') {
    const id = body.id ? Number(body.id) : null;
    let q = supabase.from('api_credentials').select('*').eq('bar_id', barId).in('sistema', ['inter', 'banco_inter']).eq('ativo', true);
    if (id) q = q.eq('id', id);
    const { data } = await q.order('id', { ascending: true }).limit(1).maybeSingle();
    if (!data) return NextResponse.json({ success: false, error: 'Nenhuma credencial Inter ativa nesse bar.' }, { status: 404 });
    try {
      const cred = await resolveInterCredential(data);
      const token = await getInterAccessToken(cred.clientId, cred.clientSecret, 'pagamento-pix.write', cred.mtls);
      return NextResponse.json({ success: !!token, id: data.id, empresa: data.empresa_nome, msg: 'Conexão OK — token obtido, certificado válido.' });
    } catch (e: any) {
      const raw = String(e?.message || e);
      // Dicas amigáveis pros erros mais comuns.
      let dica = raw;
      if (/invalid_client|unauthorized|401|403/i.test(raw)) dica = 'client_id/client_secret incorretos, ou a aplicação Inter não tem o escopo de pagamento.';
      else if (/handshake|SSL|certificate|EPROTO|ERR_|decrypt|PEM|tlsv1|alert/i.test(raw)) dica = 'Certificado/chave inválidos ou não correspondem à aplicação Inter.';
      else if (/envelope|cifrad/i.test(raw)) dica = raw; // já é claro
      return NextResponse.json({ success: false, id: data.id, error: dica }, { status: 200 });
    }
  }

  const client_id = String(body.client_id || '').trim();
  const client_secret = String(body.client_secret || '');
  const conta_corrente = String(body.conta_corrente || '').trim();
  const cert = String(body.cert || '').trim();
  const key = String(body.key || '').trim();
  const empresa_nome = String(body.empresa_nome || '').trim();
  const empresa_cnpj = body.cnpj ? String(body.cnpj).trim() : null;
  const id = body.id ? Number(body.id) : null;

  if (!client_id || !client_secret || !conta_corrente || !cert || !key) {
    return NextResponse.json({ success: false, error: 'Preencha client_id, client_secret, conta corrente, certificado e chave.' }, { status: 400 });
  }
  if (!/-----BEGIN [A-Z ]*CERTIFICATE-----/.test(cert)) {
    return NextResponse.json({ success: false, error: 'Certificado inválido — cole/suba o arquivo PEM (-----BEGIN CERTIFICATE-----).' }, { status: 400 });
  }
  if (!/-----BEGIN (RSA |EC )?PRIVATE KEY-----/.test(key)) {
    return NextResponse.json({ success: false, error: 'Chave privada inválida — esperado PEM (-----BEGIN PRIVATE KEY-----).' }, { status: 400 });
  }

  let enc: { client_secret: string; cert: string; key: string };
  try {
    enc = { client_secret: encryptSecret(client_secret), cert: encryptSecret(cert), key: encryptSecret(key) };
  } catch (e: any) {
    return NextResponse.json({ success: false, error: `Falha ao cifrar (CREDENTIALS_MASTER_KEY configurada no Vercel?): ${e?.message || e}` }, { status: 500 });
  }

  const row: any = {
    bar_id: barId, sistema: 'banco_inter', ambiente: 'producao',
    client_id, client_secret: null,
    empresa_nome: empresa_nome || `Inter bar ${barId}`, empresa_cnpj,
    ativo: true,
    configuracoes: { conta_corrente, enc },
    atualizado_em: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from('api_credentials').update(row).eq('id', id).eq('bar_id', barId).in('sistema', ['inter', 'banco_inter'])
    : await supabase.from('api_credentials').insert(row);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
