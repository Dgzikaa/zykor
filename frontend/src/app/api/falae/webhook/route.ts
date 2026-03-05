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
    const authHeader = request.headers.get('authorization') || '';
    const tokenFromBearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const tokenFromHeader = request.headers.get('x-falae-token') || '';
    const tokenFromQuery = searchParams.get('token') || '';
    const tokenFromPayload =
      typeof payload?.token === 'string' ? payload.token : '';
    const token = tokenFromBearer || tokenFromHeader || tokenFromQuery || tokenFromPayload;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Token ausente. Use Authorization Bearer, x-falae-token, query ?token= ou payload.token',
        },
        { status: 401 }
      );
    }

    const decoded = decodeJwtPayload(token);
    const companyId =
      typeof decoded?.company_id === 'string' ? decoded.company_id : null;

    const { data: credenciais, error: credenciaisError } = await supabase
      .from('api_credentials')
      .select('id, bar_id, empresa_id, api_token, ativo')
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

    const porToken = credenciaisValidas.find((row) => row.api_token === token);
    const porEmpresa = companyId
      ? credenciaisValidas.find((row) => row.empresa_id === companyId)
      : null;
    const credencial = porToken || porEmpresa;

    if (!credencial?.bar_id) {
      return NextResponse.json(
        { success: false, error: 'Token sem mapeamento ativo para bar' },
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

    const search = answer?.search || {};
    const client = answer?.client || {};
    const consumption = answer?.consumption || {};

    const row = {
      bar_id: Number(credencial.bar_id),
      falae_id: String(falaeId),
      created_at: String(createdAt),
      nps,
      discursive_question: answer?.discursive_question || null,
      criterios,
      search_id: answer?.search_id || search?.id || null,
      search_name: search?.name || null,
      client_id: answer?.client_id || client?.id || null,
      client_name: client?.name || null,
      client_email: client?.email || null,
      client_phone: client?.phone || null,
      consumption_id: consumption?.id || null,
      order_id: consumption?.order_id || null,
      raw_data: payload,
      synced_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('falae_respostas')
      .upsert(row, { onConflict: 'bar_id,falae_id' });

    if (upsertError) {
      console.error('Erro ao salvar resposta Falae:', upsertError);
      return NextResponse.json(
        { success: false, error: 'Erro ao persistir resposta' },
        { status: 500 }
      );
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
