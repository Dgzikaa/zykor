import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;
const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface CadastrarBody {
  bar_id: number;
  nome: string;
  documento?: string | null; // CPF (11) ou CNPJ (14) limpo
  email?: string | null;
  telefone?: string | null;
  tipo_perfil?: 'Fornecedor' | 'Cliente' | 'Transportadora';
  tipo_pessoa?: 'Física' | 'Jurídica' | 'Estrangeira';
}

/**
 * POST /api/financeiro/contaazul/pessoas/cadastrar
 *
 * Cria fornecedor (ou cliente/transportadora) no Conta Azul e salva ref local.
 * Schema CA v2:
 *   POST /v1/pessoas
 *   { nome, tipo_pessoa: "Física"|"Jurídica"|"Estrangeira",
 *     perfis: [{ tipo_perfil: "Fornecedor"|"Cliente"|"Transportadora" }] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CadastrarBody;
    const barId = Number(body.bar_id);
    if (!Number.isFinite(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    const nome = String(body.nome || '').trim();
    if (!nome) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Token CA do bar
    const { data: credentials, error: credError } = await supabase
      .from('api_credentials')
      .select('access_token, expires_at')
      .eq('sistema', 'conta_azul')
      .eq('bar_id', barId)
      .single();

    if (credError || !credentials?.access_token) {
      return NextResponse.json({ error: 'Credenciais CA não encontradas' }, { status: 404 });
    }
    if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token CA expirado. Reconecte.' }, { status: 401 });
    }

    const documentoLimpo = String(body.documento || '').replace(/\D/g, '');
    const tipoPessoa: 'Física' | 'Jurídica' | 'Estrangeira' =
      body.tipo_pessoa ||
      (documentoLimpo.length === 14
        ? 'Jurídica'
        : documentoLimpo.length === 11
          ? 'Física'
          : 'Física');
    const tipoPerfil = body.tipo_perfil || 'Fornecedor';

    const caBody: Record<string, unknown> = {
      nome,
      tipo_pessoa: tipoPessoa,
      perfis: [{ tipo_perfil: tipoPerfil }],
    };
    if (documentoLimpo.length === 11 || documentoLimpo.length === 14) {
      caBody.documento = documentoLimpo;
    }
    if (body.email) caBody.email = body.email;
    if (body.telefone) caBody.telefone = body.telefone;

    const caResp = await fetch(`${CONTA_AZUL_API_URL}/v1/pessoas`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(caBody),
    });

    const caRespText = await caResp.text();
    let caRespJson: any = null;
    try {
      caRespJson = caRespText ? JSON.parse(caRespText) : null;
    } catch {
      caRespJson = null;
    }

    if (!caResp.ok) {
      console.error('[CA-PESSOA-POST] Erro CA:', caResp.status, caRespText);
      return NextResponse.json(
        {
          error:
            caRespJson?.error ||
            caRespJson?.message ||
            `CA HTTP ${caResp.status}`,
          ca_status: caResp.status,
          payload_enviado: caBody,
        },
        { status: caResp.status >= 500 ? 502 : 400 }
      );
    }

    const caId = caRespJson?.id || caRespJson?.uuid;
    if (!caId) {
      return NextResponse.json(
        { error: 'CA respondeu sem id da pessoa', ca_response: caRespJson },
        { status: 502 }
      );
    }

    // Salvar local
    const localRow = {
      bar_id: barId,
      contaazul_id: caId,
      nome,
      tipo_pessoa: tipoPessoa, // valida no CHECK constraint
      documento: documentoLimpo || null,
      email: body.email || null,
      telefone: body.telefone || null,
      perfil: tipoPerfil.toUpperCase(), // local usa MAIÚSCULA: FORNECEDOR/CLIENTE
      ativo: true,
      raw_data: caRespJson,
      sincronizado_em: new Date().toISOString(),
    };

    const { error: upErr } = await (supabase
      .schema('bronze' as any) as any)
      .from('bronze_contaazul_pessoas')
      .upsert(localRow, { onConflict: 'contaazul_id' });

    if (upErr) {
      console.error('[CA-PESSOA-POST] Erro upsert local (não bloqueante):', upErr);
    }

    return NextResponse.json({
      success: true,
      contaazul_id: caId,
      nome,
      tipo_pessoa: tipoPessoa,
      tipo_perfil: tipoPerfil,
      ca_response: caRespJson,
    });
  } catch (err: any) {
    console.error('[CA-PESSOA-POST] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
