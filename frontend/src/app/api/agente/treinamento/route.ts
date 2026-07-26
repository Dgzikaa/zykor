import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser , permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  const user_POST = await authenticateUser(req);
  if (!user_POST) return permissionErrorResponse('Usuário não autenticado');
  const neg_req = negarPorRota(user_POST, req); if (neg_req) return neg_req;
  await authenticateUser(req);
  try {
    const body = await req.json();
    const { action, barId, contexto } = body;
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/agente-treinamento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ action, barId, contexto })
    });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Erro na API de treinamento:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
