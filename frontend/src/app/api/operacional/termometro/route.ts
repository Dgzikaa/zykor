import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Termômetro do dia: compara os sinais de um dia contra a mediana das últimas 6 ocorrências
 * do MESMO dia da semana (via operations.fn_termometro_dia). Sinaliza o que fugiu do padrão.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = request.nextUrl.searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const data = sp.get('data') || null; // yyyy-mm-dd; null = ontem (default na função)
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id ausente' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: res, error } = await supabase
    .schema('operations')
    .rpc('fn_termometro_dia', { p_bar_id: barId, p_data: data });

  if (error) {
    console.error('[termometro] erro:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...(res || {}) });
}
