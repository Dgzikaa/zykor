import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

/**
 * POST /api/instagram/sync-agora?bar_id=N
 *
 * Dispara o edge function ig-sync-diario na hora pro bar especificado.
 * Util pra botao "Sincronizar agora" na pagina dashboard.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, req); if (nega) return nega;
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const resp = await fetch(`${supabaseUrl}/functions/v1/ig-sync-diario`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bar_id: barId, dias_posts: 30 }),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.ok ? 200 : 502 });
  } catch (e: any) {
    console.error('[ig/sync-agora] excecao:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
