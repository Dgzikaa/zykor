import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

/**
 * POST /api/integracoes/instagram/desconectar
 * Body: { bar_id: number }
 *
 * Marca a conta como inativa. Não apaga o registro pra preservar histórico
 * (posts e métricas continuam consultáveis mesmo após desconexão).
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
    }

    const supabase = await getAdminClient();
    const { error } = await supabase
      .from('instagram_contas')
      .update({ ativo: false, desconectado_em: new Date().toISOString() })
      .eq('bar_id', barId);

    if (error) {
      console.error('[ig/desconectar] erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[ig/desconectar] exceção:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
