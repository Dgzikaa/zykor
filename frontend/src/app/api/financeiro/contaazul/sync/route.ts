import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, permissionErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// SERVICE ROLE, não anon: a edge function contaazul-sync usa requireInternalAuth, que só aceita
// x-cron-secret ou Bearer <SERVICE_ROLE_KEY>. Com a anon key o botão "Sincronizar agora" tomava
// 401 direto da function. Quem chama aqui é servidor-a-servidor, então a chave de serviço é a
// correta — e o acesso do usuário é controlado logo abaixo, não pela chave.
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  // O retorno do authenticateUser era descartado — qualquer um que passasse pelo middleware
  // disparava sync de qualquer bar.
  const user = await authenticateUser(request);
  if (!user) return permissionErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request);
  if (nega) return nega;
  try {
    const body = await request.json();
    const { bar_id, sync_mode = 'daily_incremental', date_from, date_to } = body;

    if (!bar_id) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const payload: any = {
      bar_id,
      sync_mode
    };

    if (date_from) payload.date_from = date_from;
    if (date_to) payload.date_to = date_to;

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/contaazul-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (err) {
    console.error('Erro ao sincronizar:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
