import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractAnswerPayload(payload: any): any {
  if (payload?.data?.answer) return payload.data.answer;
  if (payload?.answer) return payload.answer;
  if (payload?.data) return payload.data;
  return payload;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${url.protocol}//${url.host}`);

  return NextResponse.json({
    success: true,
    webhook_url: `${baseUrl}/api/falae/webhook`,
    method: 'POST',
    auth: 'Authorization: Bearer <token do Falae>',
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    const { searchParams } = new URL(request.url);

    const rawBody = await request.text();
    const payload = rawBody ? JSON.parse(rawBody) : {};
    // Token de validação do Falaê (campo "Token (Opcional)" no webhook)
    // O Falaê envia como header "token: xxx"
    const webhookTokenFromHeader = request.headers.get('token') || request.headers.get('x-webhook-token') || '';
    const webhookTokenFromQuery = searchParams.get('webhook_token') || '';
    const webhookTokenFromPayload = typeof payload?.webhook_token === 'string' ? payload.webhook_token : '';
    const webhookToken = webhookTokenFromHeader || webhookTokenFromQuery || webhookTokenFromPayload;

    // JWT Token (para identificar o bar via company_id)
    const authHeader = request.headers.get('authorization') || '';
    const tokenFromBearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const tokenFromHeader = request.headers.get('x-falae-token') || '';
    const tokenFromQuery = searchParams.get('token') || '';
    const tokenFromPayload =
      typeof payload?.token === 'string' ? payload.token : '';
    const jwtToken = tokenFromBearer || tokenFromHeader || tokenFromQuery || tokenFromPayload;

    // Validar: precisa de pelo menos um dos tokens (JWT ou webhook token)
    if (!jwtToken && !webhookToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Token ausente. Use Authorization Bearer (JWT) ou header "token" (webhook token)',
        },
        { status: 401 }
      );
    }

    // Buscar credenciais ativas
    const { data: credenciais, error: credenciaisError } = await supabase
      .from('api_credentials')
      .select('id, bar_id, empresa_id, api_token, ativo, webhook_url')
      .eq('sistema', 'falae')
      .eq('ativo', true);

    if (credenciaisError) {
      console.error('Erro ao buscar credenciais Falae:', credenciaisError);
      return NextResponse.json(
        { success: false, error: 'Erro ao validar credenciais' },
        { status: 500 }
      );
    }

    const credenciaisValidas = (credenciais || []) as any[];
    let credencial: any = null;

    // Estratégia 1: Validar por webhook token (se fornecido)
    if (webhookToken) {
      credencial = credenciaisValidas.find((row) => row.webhook_url === webhookToken);
      if (credencial) {
        console.log(`✅ Credencial encontrada via webhook token para bar ${credencial.bar_id}`);
      }
    }

    // Estratégia 2: Validar por JWT token (fallback)
    if (!credencial && jwtToken) {
      const decoded = decodeJwtPayload(jwtToken);
      const companyId = typeof decoded?.company_id === 'string' ? decoded.company_id : null;

      const porToken = credenciaisValidas.find((row) => row.api_token === jwtToken);
      const porEmpresa = companyId
        ? credenciaisValidas.find((row) => row.empresa_id === companyId)
        : null;
      credencial = porToken || porEmpresa;

      if (credencial) {
        console.log(`✅ Credencial encontrada via JWT para bar ${credencial.bar_id}`);
      }
    }

    if (!credencial?.bar_id) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou sem mapeamento ativo para bar' },
        { status: 403 }
      );
    }

    const answer = extractAnswerPayload(payload);
    const falaeId = answer?.id || answer?.answer_id;
    const nps = parseNumeric(answer?.nps);

    if (!falaeId || nps === null) {
      return NextResponse.json(
        { success: false, error: 'Payload inválido: id/nps obrigatórios' },
        { status: 400 }
      );
    }

    const criterios = answer?.criteria || answer?.criterios || answer?.questions || null;
    const createdAt =
      answer?.created_at ||
      answer?.createdAt ||
      new Date().toISOString();

    // Falae mudou o payload em 08/05/2026: antes vinha answer.search.name,
    // agora só vem answer.search_id no envelope { answer, client }.
    // Aceitar os dois formatos e resolver search_name via lookup quando necessário.
    const search = (answer?.search && typeof answer.search === 'object') ? answer.search : {};
    const client = answer?.client || payload?.client || {};
    const consumption = answer?.consumption || payload?.consumption || {};

    const searchId = answer?.search_id || search?.id || null;
    let searchName: string | null = search?.name || answer?.search_name || null;

    // Fallback: resolver search_name via lookup quando o payload não traz o nome
    if (!searchName && searchId) {
      const { data: known } = await supabase
        .schema('bronze' as any).from('bronze_falae_respostas')
        .select('search_name')
        .eq('bar_id', Number(credencial.bar_id))
        .eq('search_id', searchId)
        .not('search_name', 'is', null)
        .limit(1)
        .maybeSingle();
      if (known?.search_name) {
        searchName = known.search_name;
      }
    }

    // Extrair "Data do pedido" dos critérios (data real da visita)
    let dataVisita: string | null = null;
    if (Array.isArray(criterios)) {
      const dataCriterio = criterios.find(
        (c: any) => c?.nick?.toLowerCase().includes('data do pedido') && c?.type === 'Data'
      );
      if (dataCriterio?.name && /^\d{4}-\d{2}-\d{2}$/.test(dataCriterio.name)) {
        dataVisita = dataCriterio.name;
      }
    }

    const row = {
      bar_id: Number(credencial.bar_id),
      falae_id: String(falaeId),
      created_at: String(createdAt),
      nps,
      discursive_question: answer?.discursive_question || null,
      criterios,
      search_id: searchId,
      search_name: searchName,
      client_id: answer?.client_id || client?.id || null,
      client_name: client?.name || null,
      client_email: client?.email || null,
      client_phone: client?.phone || null,
      consumption_id: consumption?.id || null,
      order_id: consumption?.order_id || null,
      data_visita: dataVisita,
      raw_data: payload,
      synced_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .schema('bronze' as any).from('bronze_falae_respostas')
      .upsert(row, { onConflict: 'bar_id,falae_id' });

    if (upsertError) {
      console.error('Erro ao salvar resposta Falae:', upsertError);
      return NextResponse.json(
        { success: false, error: 'Erro ao persistir resposta' },
        { status: 500 }
      );
    }

    // Atualizar tabelas agregadas (nps_falae_diario_pesquisa)
    const dataReferencia = dataVisita || createdAt.split('T')[0];
    try {
      await supabase.rpc('recalcular_nps_diario_pesquisa', {
        p_bar_id: Number(credencial.bar_id),
        p_data_inicio: dataReferencia,
        p_data_fim: dataReferencia,
      });
    } catch (rpcError) {
      console.warn('Aviso ao atualizar nps_falae_diario_pesquisa:', rpcError);
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook Falae processado',
      bar_id: credencial.bar_id,
      falae_id: falaeId,
    });
  } catch (error) {
    console.error('Erro no webhook Falae:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
