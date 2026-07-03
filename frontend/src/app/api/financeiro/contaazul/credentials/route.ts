import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (user.role !== 'admin') return permissionErrorResponse('Apenas administradores');
  try {
    const body = await request.json();
    const { bar_id, client_id, client_secret } = body;

    if (!bar_id || !client_id || !client_secret) {
      return NextResponse.json({ error: 'bar_id, client_id e client_secret sao obrigatorios' }, { status: 400 });
    }

    const edgeFunctionUrl = SUPABASE_URL + '/functions/v1/contaazul-auth';
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        action: 'save_credentials',
        bar_id: bar_id,
        client_id: client_id,
        client_secret: client_secret
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Erro ao salvar credenciais' }, { status: response.status });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[credentials] Erro:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}