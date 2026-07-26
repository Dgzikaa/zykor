import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

/**
 * POST /api/assistente
 *   body { telefone, mensagem }
 *
 * Wrapper que chama a edge fn assistente-zykor e retorna a resposta.
 * Sem envio Umbler — só retorna JSON pra UI mostrar.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user_POST = await authenticateUser(req);
  if (!user_POST) return permissionErrorResponse('Usuário não autenticado');
  const neg_req = negarPorRota(user_POST, req); if (neg_req) return neg_req;
  await authenticateUser(req);
  try {
    const body = await req.json();
    const telefone = String(body?.telefone || '').replace(/\D/g, '');
    const mensagem = String(body?.mensagem || '').trim();
    if (!telefone || !mensagem) {
      return NextResponse.json({ error: 'telefone+mensagem obrigatorios' }, { status: 400 });
    }

    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assistente-zykor`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ telefone, mensagem }),
    });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : 502 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
