import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

/**
 * POST /api/integracoes/google/desconectar
 * Body: { bar_id: number }
 *
 * Marca inativo em vez de apagar: as métricas gmn_* já gravadas em meta.marketing_semanal
 * continuam valendo, e o refresh_token preservado permite reconectar sem novo consentimento
 * caso a desconexão tenha sido engano.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const neg = negarPorRota(user, req);
  if (neg) return neg;

  try {
    const body = await req.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

    const supabase = await getAdminClient();
    const { error } = await supabase
      .schema('integrations')
      .from('google_oauth_tokens')
      .update({ ativo: false, desconectado_em: new Date().toISOString() })
      .eq('bar_id', barId);

    if (error) {
      console.error('[google/desconectar] erro:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[google/desconectar] exceção:', e);
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 500 });
  }
}
